from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import asyncio
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orchestrator")

app = FastAPI()

PROVIDER_STATS_URL = "http://prov_stats_api:8081/api/provider_statistics"
REGISTRATION_URL = "http://reg_app:8082/api/registration"
RESERVATION_URL = "http://reservation_api:8083/api/reserve"
STATISTICS_URL = "http://stats_api:8084/api/statistics"
INVOICE_URL = "http://invoice_api:8085/api/invoices"
SEARCH_URL = "http://search_api:8086/api/search"

def _do_send_stat(payload):
    try:
        response = requests.post(f"{STATISTICS_URL}/update", json=payload, timeout=3)
        if response.status_code != 200:
            raise Exception("Non-200 response")
    except Exception:
        queue_event(f"{STATISTICS_URL}/update", payload)

def send_stat_event(event_type, provider_name=None, point_id=None, user_id=None, details=None):
    payload = {"event_type": event_type}
    if provider_name: payload["provider_name"] = provider_name
    if point_id: payload["point_id"] = point_id
    if user_id: payload["user_id"] = user_id
    if details: payload["details"] = details
    threading.Thread(target=_do_send_stat, args=(payload,), daemon=True).start()

def send_provider_stat(provider_name, point_id, event_type, point_status):
    payload = {"providerName": provider_name, "pointId": point_id,
               "eventType": event_type, "isSuccess": True, "pointStatus": point_status}
    def _send():
        try:
            requests.post(f"{PROVIDER_STATS_URL}/update", json=payload, timeout=3)
        except Exception:
            queue_event(f"{PROVIDER_STATS_URL}/update", payload)
    threading.Thread(target=_send, daemon=True).start()


# --- RETRY QUEUE για non-critical events ---
pending_events = []  # In-memory queue
MAX_RETRIES = 5

def queue_event(url: str, payload: dict):
    """Προσθέτει αποτυχημένο event στην ουρά retry"""
    pending_events.append({
        "url": url,
        "payload": payload,
        "retries": 0,
        "next_retry": time.time() + 1  # Πρώτο retry σε 1 δευτερόλεπτο
    })
    logger.info(f"Event queued for retry: {url} | Queue size: {len(pending_events)}")

async def retry_worker():
    """Background task που ξαναστέλνει αποτυχημένα events με exponential backoff"""
    while True:
        await asyncio.sleep(5)  # Τρέχει κάθε 5 δευτερόλεπτα
        now = time.time()
        still_pending = []
        
        for event in pending_events:
            if now < event["next_retry"]:
                still_pending.append(event)
                continue
            
            try:
                response = requests.post(event["url"], json=event["payload"], timeout=3)
                if response.status_code == 200:
                    logger.info(f"Retry SUCCESS: {event['url']}")
                    continue  # Πέτυχε, δεν το ξανα-βάζουμε
            except Exception:
                pass
            
            event["retries"] += 1
            if event["retries"] >= MAX_RETRIES:
                logger.warning(f"DEAD LETTER - Event dropped μετά από {MAX_RETRIES} αποτυχίες: {event['url']} | payload: {event['payload']}")
                continue  # Πετάμε το event
            
            # Exponential backoff: 1s, 2s, 4s, 8s, 16s
            event["next_retry"] = now + (2 ** event["retries"])
            still_pending.append(event)
        
        pending_events.clear()
        pending_events.extend(still_pending)

@app.on_event("startup")
async def start_retry_worker():
    asyncio.create_task(retry_worker())

class ProviderRegJSON(BaseModel):
    providerName: str
    apiBaseUrl: str
    apiKey: str
    listPointsEndpoint: str
    supportsReservations: bool = False
    hasLiveStatus: bool = False

# Το ίδιο "καλούπι" που στέλνει ο χρήστης
class ReservationReqJSON(BaseModel):
    pointId: str
    userId: str
    provider: str
    duration: int = 60

class InvoiceCreateReq(BaseModel):
    providerName: str
    month: int
    year: int
    totalPoints: int

class InvoiceStatusUpdate(BaseModel):
    status: str

@app.post("/api/orchestrator/reserve")
def orchestrate_reservation(req: ReservationReqJSON):
    # ΒΗΜΑ 1: Ζητάμε από το Reservation Service να κάνει την κράτηση
    try:
        res_response = requests.post(RESERVATION_URL, json=req.dict())
        res_data = res_response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Reservation Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")

    if res_response.status_code == 200 and res_data.get("success") == True:
        send_stat_event("RESERVATION_MADE", provider_name=req.provider, point_id=req.pointId, user_id=req.userId)
        send_provider_stat(req.provider, req.pointId, "Reservation", "reserved")
    return res_data


@app.put("/api/orchestrator/reserve/{res_id}/cancel")
def orchestrate_cancellation(res_id: str, user_id: str):
    # ΒΗΜΑ 1: Ζητάμε ακύρωση από το Reservation Service
    try:
        cancel_url = f"{RESERVATION_URL}/{res_id}/cancel"
        res_response = requests.put(cancel_url, params={"user_id": user_id})
        res_data = res_response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Reservation Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")

    # ΒΗΜΑ 2: Αν η ακύρωση ΠΕΤΥΧΕ, ειδοποιούμε το Statistics Service
    if res_response.status_code == 200 and res_data.get("success") == True:
        try:
           send_stat_event("RESERVATION_CANCELLED", user_id=user_id, details={"reservation_id": res_id})
        except Exception:
            pass

    return res_data

# --- CLICK TRACKING ---
@app.post("/api/orchestrator/click")
def track_click(req: dict):
    send_stat_event("CLICK", provider_name=req.get("provider"), point_id=req.get("pointId"))
    send_provider_stat(req.get("provider"), req.get("pointId"), "Click", "clicked")
    return {"success": True}

# --- GLOBAL STATISTICS (PROXY) ---
@app.get("/api/orchestrator/statistics/global")
def orchestrate_global_stats():
    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            f1 = ex.submit(requests.get, f"{STATISTICS_URL}/global/filter")
            f2 = ex.submit(requests.get, f"{STATISTICS_URL}/global")
            res, res2 = f1.result(), f2.result()
        data = res.json()
        data["total_reservations"] = res2.json().get("data", {}).get("total_reservations", 0)
        return data
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- USER: ΚΡΑΤΗΣΕΙΣ ΑΝΑ ΧΡΗΣΤΗ ---
@app.get("/api/orchestrator/reservations/user/{user_id}")
def orchestrate_user_reservations(user_id: str):
    try:
        res = requests.get(RESERVATION_URL.replace("/api/reserve", f"/api/reservations/user/{user_id}"))
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- ADMIN: ΛΙΣΤΑ ΚΡΑΤΗΣΕΩΝ ---
@app.get("/api/orchestrator/admin/reservations")
def orchestrate_list_reservations():
    try:
        res = requests.get(RESERVATION_URL.replace("/api/reserve", "/api/admin/reservations"))
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- ADMIN: ΑΚΥΡΩΣΗ ΚΡΑΤΗΣΗΣ ---
@app.put("/api/orchestrator/admin/reservations/{res_id}/cancel")
def orchestrate_admin_cancel(res_id: str):
    try:
        url = RESERVATION_URL.replace("/api/reserve", f"/api/admin/reservations/{res_id}/cancel")
        res = requests.put(url)
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            send_stat_event("RESERVATION_CANCELLED", details={"reservation_id": res_id})
        return data
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- DETAILED STATS ΑΝΑ ΠΑΡΟΧΟ ---
@app.get("/api/orchestrator/statistics/provider/{provider_name}/detailed")
def get_provider_detailed_stats(provider_name: str):
    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            f1 = ex.submit(requests.get, f"{STATISTICS_URL}/global/filter", params={"provider_name": provider_name})
            f2 = ex.submit(requests.get, f"{PROVIDER_STATS_URL}/{provider_name}/summary")
        data = f1.result().json()
        summary = f2.result().json()
        data["summary"] = summary.get("statistics", {})
        return data
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- 3. ΠΡΟΒΟΛΗ ΣΤΑΤΙΣΤΙΚΩΝ ΠΑΡΟΧΟΥ (PROXY) ---
@app.get("/api/orchestrator/statistics/provider/{provider_name}")
def get_orchestrated_provider_stats(provider_name: str):
    try:
        # Ο Orchestrator καλεί εσωτερικά το Provider Statistics Service (8084)
        target_url = f"{PROVIDER_STATS_URL}/{provider_name}/summary"
        
        response = requests.get(target_url)
        
        # Αν το service μας απαντήσει με σφάλμα, το μεταφέρουμε στον χρήστη
        if response.status_code != 200:
            return response.json()
            
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Provider Statistics Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")


# --- 4. REGISTRATION SERVICE (PROXY) ---

@app.post("/api/orchestrator/providers/register")
def orchestrate_register_provider(req: ProviderRegJSON):
    try:
        response = requests.post(REGISTRATION_URL, json=req.dict())
        if response.status_code in (200, 201):
            send_stat_event("PROVIDER_REGISTERED", provider_name=req.providerName)
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Registration Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")


@app.get("/api/orchestrator/providers")
def orchestrate_list_providers():
    try:
        response = requests.get(f"{REGISTRATION_URL}/providers")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Registration Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")


@app.get("/api/orchestrator/providers/{provider_name}")
def orchestrate_get_provider(provider_name: str):
    try:
        response = requests.get(f"{REGISTRATION_URL}/providers/{provider_name}")
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Registration Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")


@app.delete("/api/orchestrator/providers/{provider_name}")
def orchestrate_delete_provider(provider_name: str):
    try:
        response = requests.delete(f"{REGISTRATION_URL}/providers/{provider_name}")
        if response.status_code == 200:
            send_stat_event("PROVIDER_DELETED", provider_name=provider_name)
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Το Registration Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")

@app.get("/api/orchestrator/search")
def orchestrate_search():
    try:
        response = requests.get(SEARCH_URL)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Σφάλμα στο Search Service")
        search_results = response.json()
        send_stat_event("SEARCH_PERFORMED", details={"results_count": len(search_results) if isinstance(search_results, list) else 0})
        return search_results
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Το Search Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")
    
@app.get("/health")
def health_check():
    services = {
        "reservation":   RESERVATION_URL.replace("/api/reserve", ""),
        "statistics":    STATISTICS_URL.replace("/api/statistics", ""),
        "provider_stats": PROVIDER_STATS_URL.replace("/api/provider_statistics", ""),
        "registration":   REGISTRATION_URL.replace("/api/registration", ""),
        "search":         SEARCH_URL.replace("/api/search", ""),
        "invoice":        INVOICE_URL.replace("/api/invoices", ""),
    }
    def check(name, url):
        try:
            r = requests.get(f"{url}/docs", timeout=2)
            return name, "UP" if r.status_code == 200 else "DOWN"
        except:
            return name, "DOWN"
    with ThreadPoolExecutor(max_workers=len(services)) as ex:
        results = ex.map(lambda item: check(*item), services.items())
    status = dict(results)
    status["orchestrator"] = "UP"
    status["pending_retry_events"] = len(pending_events)
    return status
    
# --- 5. INVOICE SERVICE (PROXY) ---

@app.post("/api/orchestrator/invoices/generate")
def orchestrate_generate_invoice(req: InvoiceCreateReq):
    try:
        response = requests.post(f"{INVOICE_URL}/generate", json=req.dict())
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Το Invoice Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")

@app.get("/api/orchestrator/invoices/provider/{provider_name}")
def orchestrate_get_provider_invoices(provider_name: str):
    try:
        response = requests.get(f"{INVOICE_URL}/provider/{provider_name}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Το Invoice Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")

@app.put("/api/orchestrator/invoices/{invoice_id}/status")
def orchestrate_update_invoice_status(invoice_id: int, update: InvoiceStatusUpdate):
    try:
        response = requests.put(f"{INVOICE_URL}/{invoice_id}/status", json=update.dict())
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Το Invoice Service δεν είναι διαθέσιμο. Σφάλμα: {str(e)}")
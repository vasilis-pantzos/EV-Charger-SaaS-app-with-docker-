from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mysql.connector
import requests

app = FastAPI()

def get_db_connection():
    return mysql.connector.connect(
        host="reg_db", 
        user="reg_user",
        password="reg_password",
        database="registration_db"
    )

# --- Pydantic Models (DTOs) ---

class ProviderRegJSON(BaseModel):
    providerName: str
    apiBaseUrl: str
    apiKey: str
    listPointsEndpoint: str
    supportsReservations: bool = False
    hasLiveStatus: bool = False

class ProviderResponse(BaseModel):
    id: int
    providerName: str
    apiBaseUrl: str
    listPointsEndpoint: str
    supportsReservations: bool
    hasLiveStatus: bool


# --- 1. ΕΓΓΡΑΦΗ ΠΑΡΟΧΟΥ ---
@app.post("/api/registration")
def register_provider(req: ProviderRegJSON):
    
    # ΒΗΜΑ 1: Health check - Δοκιμαστική κλήση στο API του παρόχου
    try:
        test_url = req.apiBaseUrl.rstrip("/") + "/" + req.listPointsEndpoint.lstrip("/")
        headers = {"Authorization": f"Bearer {req.apiKey}"}
        response = requests.get(test_url, headers=headers, timeout=10)
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to connect to provider API. Please check the URL.")

    if response.status_code != 200:
        raise HTTPException(
            status_code=400, 
            detail=f"Provider API responded with error: {response.status_code}. Please check your credentials."
        )

    # ΒΗΜΑ 2: Αποθήκευση στη βάση
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute(
            "INSERT INTO Provider (providerName, apiBaseUrl, apiKey, listPointsEndpoint, supportsReservations, hasLiveStatus) VALUES (%s, %s, %s, %s, %s, %s)",
            (req.providerName, req.apiBaseUrl, req.apiKey, req.listPointsEndpoint, req.supportsReservations, req.hasLiveStatus)
        )
        db.commit()
        return {"status": "success", "detail": f"Ο πάροχος '{req.providerName}' εγγράφηκε επιτυχώς."}
    except mysql.connector.IntegrityError:
        raise HTTPException(status_code=409, detail=f"Ο πάροχος '{req.providerName}' υπάρχει ήδη.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


# --- 2. ΛΙΣΤΑ ΠΑΡΟΧΩΝ ---
@app.get("/api/registration/providers")
def list_providers():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, providerName, apiBaseUrl, listPointsEndpoint, supportsReservations, hasLiveStatus FROM Provider")
        providers = cursor.fetchall()
        return {"status": "success", "providers": providers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


# --- 3. ΣΤΟΙΧΕΙΑ ΣΥΓΚΕΚΡΙΜΕΝΟΥ ΠΑΡΟΧΟΥ ---
@app.get("/api/registration/providers/{provider_name}")
def get_provider(provider_name: str):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, providerName, apiBaseUrl, apiKey, listPointsEndpoint, supportsReservations, hasLiveStatus FROM Provider WHERE providerName = %s", (provider_name,))
        provider = cursor.fetchone()
        if not provider:
            raise HTTPException(status_code=404, detail=f"Ο πάροχος '{provider_name}' δεν βρέθηκε.")
        return {"status": "success", "provider": provider}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


# --- 4. ΔΙΑΓΡΑΦΗ ΠΑΡΟΧΟΥ ---
@app.delete("/api/registration/providers/{provider_name}")
def delete_provider(provider_name: str):
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM Provider WHERE providerName = %s", (provider_name,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"provider '{provider_name}' not found.")
        db.commit()
        return {"status": "success", "detail": f"provider '{provider_name}' deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
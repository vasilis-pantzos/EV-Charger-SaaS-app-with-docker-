from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mysql.connector

app = FastAPI(title="Invoice Service", description="Διαχείριση μηνιαίων συνδρομών")

# Σταθερή χρέωση ανά σημείο φόρτισης (π.χ. 10 ευρώ)
PRICE_PER_POINT = 10.00

def get_db_connection():
    return mysql.connector.connect(
        host="inv_db", 
        user="invoice_user",
        password="invoice_password",
        database="invoice_db"
    )

# Σταθερή χρέωση ανά σημείο φόρτισης (π.χ. 10 ευρώ)
PRICE_PER_POINT = 10.00

# --- Pydantic Models ---
class InvoiceCreateReq(BaseModel):
    providerName: str
    month: int
    year: int
    totalPoints: int

class InvoiceStatusUpdate(BaseModel):
    status: str

# --- Endpoints ---
@app.post("/api/invoices/generate")
def generate_monthly_invoice(req: InvoiceCreateReq):
    conn = get_db_connection()
    cursor = conn.cursor()

    total_amount = req.totalPoints * PRICE_PER_POINT

    try:
        # Έλεγχος αν υπάρχει ήδη τιμολόγιο για αυτόν τον μήνα/χρονιά για τον πάροχο
        cursor.execute(
            "SELECT invoice_id FROM invoices WHERE provider_name = %s AND billing_month = %s AND billing_year = %s",
            (req.providerName, req.month, req.year)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Έχει ήδη εκδοθεί τιμολόγιο για αυτόν τον μήνα.")

        # Εισαγωγή νέου τιμολογίου
        cursor.execute(
            """
            INSERT INTO invoices (provider_name, billing_month, billing_year, total_points, price_per_point, total_amount) 
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (req.providerName, req.month, req.year, req.totalPoints, PRICE_PER_POINT, total_amount)
        )
        conn.commit()
        invoice_id = cursor.lastrowid
        
        return {
            "status": "success", 
            "detail": "Το τιμολόγιο εκδόθηκε επιτυχώς",
            "invoice": {
                "id": invoice_id,
                "amount": total_amount,
                "status": "PENDING"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/invoices/provider/{provider_name}")
def get_provider_invoices(provider_name: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM invoices WHERE provider_name = %s ORDER BY billing_year DESC, billing_month DESC",
            (provider_name,)
        )
        results = cursor.fetchall()
        return {"providerName": provider_name, "invoices": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/api/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: int, update: InvoiceStatusUpdate):
    if update.status not in ["PENDING", "PAID", "CANCELLED"]:
        raise HTTPException(status_code=400, detail="Μη έγκυρη κατάσταση. Επιτρεπτές: PENDING, PAID, CANCELLED")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("UPDATE invoices SET status = %s WHERE invoice_id = %s", (update.status, invoice_id))
        conn.commit()
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Το τιμολόγιο δεν βρέθηκε")
            
        return {"status": "success", "detail": f"Η κατάσταση ενημερώθηκε σε {update.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
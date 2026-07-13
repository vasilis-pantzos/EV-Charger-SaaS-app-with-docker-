from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from enum import Enum
import mysql.connector
import os

app = FastAPI()

# Αντλούμε τα στοιχεία σύνδεσης κατευθείαν από το docker-compose.yml
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "provider_statistics_db")

def get_db_connection():
    return mysql.connector.connect(
        host="prov_stats_db", 
        user="prov_stats_user",
        password="prov_stats_password",
        database="provider_statistics_db"
    )

class EventType(str, Enum):
    Click = "Click"
    Reservation = "Reservation"

class EventCreate(BaseModel):
    providerName: str
    pointId: str
    eventType: EventType
    isSuccess: bool
    pointStatus: str

@app.post("/api/provider_statistics/update")
def record_event(event: EventCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Διορθώθηκε το όνομα του πίνακα (point_stats αντί για users)
        cursor.execute(
            "INSERT INTO point_stats (provider_name, point_id, event_type, is_success, point_status) VALUES (%s, %s, %s, %s, %s)",
            (event.providerName, event.pointId, event.eventType.value, event.isSuccess, event.pointStatus)
        )
        conn.commit()
        return {"status": "success", "detail": "Το γεγονός καταγράφηκε επιτυχώς"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/provider_statistics/{provider_name}/summary")
def get_provider_summary(provider_name: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Διορθώθηκε το WHERE για να ψάχνει provider_name, όχι provider_id
        cursor.execute(
            "SELECT event_type, COUNT(*) as count FROM point_stats WHERE provider_name = %s GROUP BY event_type",
            (provider_name,)
        )
        results = cursor.fetchall()

        stats = {"Click": 0, "Reservation": 0}
        for row in results:
            stats[row['event_type']] = row['count']

        return {
            "status": "success",
            "providerName": provider_name,
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from fastapi import Query
import json
import mysql.connector

app = FastAPI()

# Μοντέλο για την ενημέρωση από τον Orchestrator
class StatUpdate(BaseModel):
    event_type: str
    provider_name: Optional[str] = None
    point_id: Optional[str] = None
    user_id: Optional[str] = None
    details: Optional[dict] = None

def get_db_connection():
    return mysql.connector.connect(
        host="stats_db",
        user="stats_user",
        password="stats_password",
        database="statistics_db"
    )

# --- 1. ENDPOINT ΓΙΑ ΤΟΝ ORCHESTRATOR (Ενημέρωση) ---
EVENT_TO_METRIC = {
    "RESERVATION_MADE": "total_reservations",
    "RESERVATION_CANCELLED": "total_cancellations",
    "SEARCH_PERFORMED": "total_searches",
    "PROVIDER_REGISTERED": "total_registrations",
    "CLICK": "total_clicks",
}

@app.post("/api/statistics/update")
def update_stats(update: StatUpdate):
    db = get_db_connection()
    cursor = db.cursor()
    try:
        # 1. Καταγραφή στο event log
        details_json = json.dumps(update.details) if update.details else None
        cursor.execute(
            "INSERT INTO GlobalEvents (event_type, provider_name, point_id, user_id, details) VALUES (%s, %s, %s, %s, %s)",
            (update.event_type, update.provider_name, update.point_id, update.user_id, details_json)
        )
        # 2. Ενημέρωση μετρητή
        metric = EVENT_TO_METRIC.get(update.event_type)
        if metric:
            cursor.execute("UPDATE GlobalStats SET metric_value = metric_value + 1 WHERE metric_name = %s", (metric,))
        if update.event_type == "PROVIDER_REGISTERED":
            cursor.execute("UPDATE GlobalStats SET metric_value = metric_value + 1 WHERE metric_name = 'active_providers'")
        elif update.event_type == "PROVIDER_DELETED":
            cursor.execute("UPDATE GlobalStats SET metric_value = GREATEST(metric_value - 1, 0) WHERE metric_name = 'active_providers'")
        
        db.commit()
        return {"status": "updated", "event_type": update.event_type}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


# --- 2. ENDPOINT ΓΙΑ ΤΟΝ ADMIN (Προβολή) ---
@app.get("/api/statistics/global")
def get_global_statistics():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM GlobalStats")
        rows = cursor.fetchall()
        # Μετατρέπουμε τη λίστα σε ένα ωραίο dictionary
        stats = {row['metric_name']: row['metric_value'] for row in rows}
        return {
            "status": "success",
            "data": stats
        }
    finally:
        cursor.close()
        db.close()


@app.get("/api/statistics/global/filter")
def get_filtered_statistics(
    provider_name: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        where_clauses = []
        params = []
        if provider_name:
            where_clauses.append("provider_name = %s")
            params.append(provider_name)
        if event_type:
            where_clauses.append("event_type = %s")
            params.append(event_type)
        if date_from:
            where_clauses.append("created_at >= %s")
            params.append(datetime.combine(date_from, datetime.min.time()))
        if date_to:
            where_clauses.append("created_at <= %s")
            params.append(datetime.combine(date_to, datetime.max.time()))

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        cursor.execute(f"SELECT event_type, COUNT(*) as count FROM GlobalEvents WHERE {where_sql} GROUP BY event_type ORDER BY count DESC", tuple(params))
        by_type = cursor.fetchall()

        cursor.execute(f"SELECT provider_name, COUNT(*) as count FROM GlobalEvents WHERE {where_sql} AND provider_name IS NOT NULL GROUP BY provider_name ORDER BY count DESC", tuple(params))
        by_provider = cursor.fetchall()

        cursor.execute(f"SELECT DATE(created_at) as day, COUNT(*) as count FROM GlobalEvents WHERE {where_sql} GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30", tuple(params))
        daily = cursor.fetchall()
        for row in daily:
            row['day'] = str(row['day'])

        cursor.execute(f"SELECT COUNT(*) as total FROM GlobalEvents WHERE {where_sql}", tuple(params))
        total = cursor.fetchone()['total']

        return {
            "status": "success",
            "total_events": total,
            "by_event_type": by_type,
            "by_provider": by_provider,
            "daily_breakdown": daily
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@app.get("/api/statistics/global/provider/{provider_name}")
def get_provider_global_stats(provider_name: str):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT event_type, COUNT(*) as count FROM GlobalEvents WHERE provider_name = %s GROUP BY event_type", (provider_name,))
        by_type = cursor.fetchall()
        cursor.execute("SELECT COUNT(*) as total FROM GlobalEvents WHERE provider_name = %s", (provider_name,))
        total = cursor.fetchone()['total']
        return {"status": "success", "provider_name": provider_name, "total_events": total, "by_event_type": by_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@app.get("/api/statistics/global/recent")
def get_recent_events(limit: int = Query(20, ge=1, le=100)):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM GlobalEvents ORDER BY created_at DESC LIMIT %s", (limit,))
        events = cursor.fetchall()
        for e in events:
            e['created_at'] = str(e['created_at'])
            if e['details']:
                try:
                    e['details'] = json.loads(e['details'])
                except:
                    pass
        return {"status": "success", "events": events}
    finally:
        cursor.close()
        db.close()
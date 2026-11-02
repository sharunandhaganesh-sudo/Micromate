from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.config import settings as app_settings
from backend.app.models.models import AuditLog, User
from backend.app.api.deps import require_admin, require_operator

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("")
def get_system_settings():
    return {
        "project_name": app_settings.PROJECT_NAME,
        "api_version": "v1",
        "default_timezone": "UTC",
        "units": {
            "temperature": "Celsius (°C)",
            "humidity": "Percentage (%)",
            "pressure": "Hectopascals (hPa)",
            "wind_speed": "Meters/sec (m/s) [frontend conversion to km/h available]",
            "rainfall": "Millimeters (mm)",
            "rain_rate": "Millimeters/hour (mm/h)"
        },
        "thresholds": {
            "stale_device_seconds": app_settings.DEVICE_STALE_THRESHOLD_SECONDS,
            "offline_device_seconds": app_settings.DEVICE_OFFLINE_THRESHOLD_SECONDS
        },
        "integrations": {
            "mqtt_broker": f"{app_settings.MQTT_BROKER_HOST}:{app_settings.MQTT_BROKER_PORT}",
            "smtp_configured": bool(app_settings.SMTP_HOST),
            "telegram_configured": bool(app_settings.TELEGRAM_BOT_TOKEN)
        }
    }

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "user_id": l.user_id,
            "username": l.user.username if l.user else "System",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "timestamp": l.timestamp
        })
    return results

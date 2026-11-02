import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import ThingSpeakChannel, User
from backend.app.services.thingspeak_service import (
    thingspeak_service, mask_api_key, DEFAULT_FIELD_MAPPING
)
from backend.app.api.deps import require_operator, get_current_user

router = APIRouter(prefix="/thingspeak", tags=["ThingSpeak Cloud Integration"])

class ThingSpeakConfigUpdate(BaseModel):
    channel_id: str = Field(..., min_length=1, max_length=50)
    channel_name: Optional[str] = None
    read_api_key: Optional[str] = None
    write_api_key: Optional[str] = None
    is_enabled: bool = True
    sync_interval_seconds: int = Field(20, ge=10, le=3600)
    field_mapping: Optional[Dict[str, str]] = None
    station_id: Optional[str] = None

class ThingSpeakTestRequest(BaseModel):
    channel_id: str
    read_api_key: Optional[str] = None

@router.get("/config")
def get_thingspeak_config(db: Session = Depends(get_db)):
    """
    Returns ThingSpeak configuration with API keys strictly masked.
    Private keys are NEVER exposed to the frontend.
    """
    ch = thingspeak_service.get_or_create_primary_channel(db)

    mapping = DEFAULT_FIELD_MAPPING.copy()
    if ch.field_mapping:
        try:
            mapping.update(json.loads(ch.field_mapping))
        except Exception:
            pass

    return {
        "id": ch.id,
        "channel_id": ch.channel_id,
        "channel_name": ch.channel_name,
        "is_enabled": ch.is_enabled,
        "sync_interval_seconds": ch.sync_interval_seconds,
        "has_read_api_key": bool(ch.read_api_key),
        "read_api_key_masked": mask_api_key(ch.read_api_key),
        "has_write_api_key": bool(ch.write_api_key),
        "write_api_key_masked": mask_api_key(ch.write_api_key),
        "field_mapping": mapping,
        "last_entry_id": ch.last_entry_id,
        "last_synced_at": ch.last_synced_at,
        "status": ch.status,
        "last_error": ch.last_error,
        "station_id": ch.station_id
    }

@router.put("/config")
def update_thingspeak_config(
    cfg_in: ThingSpeakConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    """
    Updates ThingSpeak Channel configuration. Requires Operator or Administrator role.
    """
    ch = thingspeak_service.get_or_create_primary_channel(db)

    ch.channel_id = cfg_in.channel_id.strip()
    if cfg_in.channel_name:
        ch.channel_name = cfg_in.channel_name
    if cfg_in.read_api_key is not None:
        # Only update if non-empty, otherwise retain existing if not blanked
        ch.read_api_key = cfg_in.read_api_key.strip() if cfg_in.read_api_key else None
    if cfg_in.write_api_key is not None:
        ch.write_api_key = cfg_in.write_api_key.strip() if cfg_in.write_api_key else None
    
    ch.is_enabled = cfg_in.is_enabled
    ch.sync_interval_seconds = cfg_in.sync_interval_seconds
    if cfg_in.station_id:
        ch.station_id = cfg_in.station_id

    if cfg_in.field_mapping:
        ch.field_mapping = json.dumps(cfg_in.field_mapping)

    ch.status = "ACTIVE" if ch.is_enabled and ch.channel_id != "UNCONFIGURED" else "UNCONFIGURED"
    db.commit()
    db.refresh(ch)

    return {"message": "ThingSpeak configuration updated successfully", "channel_id": ch.channel_id}

@router.post("/test")
async def test_thingspeak_connection(req: ThingSpeakTestRequest, db: Session = Depends(get_db)):
    """
    Tests live HTTP REST connectivity to a ThingSpeak Channel.
    """
    # If read_api_key is omitted, check if one is saved for this channel
    read_key = req.read_api_key
    if not read_key:
        ch = db.query(ThingSpeakChannel).filter(ThingSpeakChannel.channel_id == req.channel_id).first()
        if ch and ch.read_api_key:
            read_key = ch.read_api_key

    result = await thingspeak_service.test_channel_connection(req.channel_id, read_key)
    return result

@router.post("/sync")
async def trigger_thingspeak_sync(db: Session = Depends(get_db), current_user: User = Depends(require_operator)):
    """
    Triggers an immediate on-demand synchronization from ThingSpeak Cloud.
    """
    ch = thingspeak_service.get_or_create_primary_channel(db)
    count, err = await thingspeak_service.sync_channel(db, ch, results_count=20)
    if err:
        return {"status": "error", "message": err, "ingested_count": 0}
    return {"status": "ok", "message": f"Successfully synced {count} entries from ThingSpeak.", "ingested_count": count}

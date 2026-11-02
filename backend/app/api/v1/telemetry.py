from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import DeviceCredential, Measurement, Device
from backend.app.schemas.schemas import MeasurementResponse
from backend.app.services.ingestion import ingestion_service

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.post("", status_code=201)
async def ingest_http_telemetry(
    payload: dict,
    x_device_token: Optional[str] = Header(None, alias="X-Device-Token"),
    db: Session = Depends(get_db)
):
    """
    HTTP ingestion endpoint for field devices or testing.
    Verifies device token if provided, validates payload contract v1,
    normalizes data, flags quality, detects events, and broadcasts live.
    """
    authenticated_id = None
    if x_device_token:
        cred = db.query(DeviceCredential).filter(
            DeviceCredential.token == x_device_token,
            DeviceCredential.is_revoked == False
        ).first()
        if not cred:
            raise HTTPException(status_code=401, detail="Invalid or revoked device token")
        authenticated_id = cred.device.device_identifier

    success, message, measurement = await ingestion_service.ingest_telemetry(
        db=db,
        payload_data=payload,
        is_simulated=False,
        authenticated_device_id=authenticated_id
    )

    if not success:
        raise HTTPException(status_code=422, detail=message)

    return {"status": "ok", "message": message, "id": measurement.id if measurement else None}

@router.get("/latest", response_model=Optional[MeasurementResponse])
def get_latest_telemetry(
    station_id: Optional[str] = None,
    device_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Measurement)
    if station_id:
        q = q.filter(Measurement.station_id == station_id)
    if device_id:
        q = q.filter(Measurement.device_id == device_id)
    m = q.order_by(desc(Measurement.timestamp)).first()
    return MeasurementResponse.model_validate(m) if m else None

@router.get("", response_model=List[MeasurementResponse])
def query_telemetry(
    station_id: Optional[str] = None,
    device_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    q = db.query(Measurement)
    if station_id:
        q = q.filter(Measurement.station_id == station_id)
    if device_id:
        q = q.filter(Measurement.device_id == device_id)
    if start_time:
        q = q.filter(Measurement.timestamp >= start_time)
    if end_time:
        q = q.filter(Measurement.timestamp <= end_time)

    records = q.order_by(desc(Measurement.timestamp)).offset(offset).limit(limit).all()
    return [MeasurementResponse.model_validate(r) for r in records]

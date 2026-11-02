from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import Station, Device, Incident, Measurement, AuditLog, User
from backend.app.schemas.schemas import StationCreate, StationUpdate, StationResponse, DeviceResponse, IncidentResponse
from backend.app.api.deps import require_operator, require_admin, get_current_user

router = APIRouter(prefix="/stations", tags=["Stations"])

@router.get("", response_model=List[StationResponse])
def list_stations(db: Session = Depends(get_db)):
    stations = db.query(Station).order_by(Station.created_at.asc()).all()
    results = []
    for s in stations:
        dev_count = db.query(Device).filter(Device.station_id == s.id).count()
        inc_count = db.query(Incident).filter(
            Incident.station_id == s.id,
            Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"])
        ).count()
        s_res = StationResponse.model_validate(s)
        s_res.device_count = dev_count
        s_res.active_incidents_count = inc_count
        s_res.status = "Warning" if inc_count > 0 else "Normal"
        results.append(s_res)
    return results

@router.post("", response_model=StationResponse)
def create_station(
    station_in: StationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    existing = db.query(Station).filter(Station.code == station_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Station code '{station_in.code}' already exists.")

    station = Station(
        code=station_in.code,
        name=station_in.name,
        description=station_in.description,
        location_name=station_in.location_name,
        latitude=station_in.latitude,
        longitude=station_in.longitude,
        timezone=station_in.timezone,
        is_demo=station_in.is_demo
    )
    db.add(station)
    db.commit()
    db.refresh(station)

    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_STATION",
        entity_type="STATION",
        entity_id=station.id,
        details=f"Station {station.name} ({station.code}) created"
    )
    db.add(audit)
    db.commit()

    return StationResponse.model_validate(station)

@router.get("/{station_id}")
def get_station_detail(station_id: str, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    devices = db.query(Device).filter(Device.station_id == station.id).all()
    incidents = db.query(Incident).filter(
        Incident.station_id == station.id
    ).order_by(desc(Incident.start_time)).limit(10).all()

    latest_m = db.query(Measurement).filter(
        Measurement.station_id == station.id
    ).order_by(desc(Measurement.timestamp)).first()

    return {
        "station": StationResponse.model_validate(station),
        "devices": [DeviceResponse.model_validate(d) for d in devices],
        "recent_incidents": [IncidentResponse.model_validate(i) for i in incidents],
        "latest_measurement": latest_m
    }

@router.put("/{station_id}", response_model=StationResponse)
def update_station(
    station_id: str,
    station_in: StationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    for field, val in station_in.model_dump(exclude_unset=True).items():
        setattr(station, field, val)

    db.commit()
    db.refresh(station)
    return StationResponse.model_validate(station)

@router.delete("/{station_id}")
def delete_station(
    station_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    db.delete(station)
    db.commit()
    return {"message": f"Station {station.name} deleted successfully"}

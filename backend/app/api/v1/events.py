from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import Incident, IncidentEvidence, AuditLog, User
from backend.app.schemas.schemas import (
    IncidentResponse, IncidentAcknowledgeRequest, IncidentResolveRequest, IncidentDismissRequest
)
from backend.app.api.deps import require_operator, get_current_user

router = APIRouter(prefix="/events", tags=["Events & Alerts"])

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    station_id: Optional[str] = None,
    device_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    is_simulated: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    q = db.query(Incident)
    if station_id:
        q = q.filter(Incident.station_id == station_id)
    if device_id:
        q = q.filter(Incident.device_id == device_id)
    if status:
        q = q.filter(Incident.status == status)
    if severity:
        q = q.filter(Incident.severity == severity)
    if event_type:
        q = q.filter(Incident.event_type == event_type)
    if is_simulated is not None:
        q = q.filter(Incident.is_simulated == is_simulated)

    incidents = q.order_by(desc(Incident.last_occurrence)).offset(offset).limit(limit).all()
    return [IncidentResponse.model_validate(i) for i in incidents]

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentResponse.model_validate(inc)

@router.post("/{incident_id}/acknowledge", response_model=IncidentResponse)
def acknowledge_incident(
    incident_id: str,
    ack_req: IncidentAcknowledgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "ACKNOWLEDGED"
    inc.acknowledged_at = utc_now()
    inc.acknowledged_by = ack_req.acknowledged_by or current_user.username

    audit = AuditLog(
        user_id=current_user.id,
        action="ACKNOWLEDGE_INCIDENT",
        entity_type="INCIDENT",
        entity_id=inc.id,
        details=f"Incident {inc.id} ({inc.event_type}) acknowledged by {inc.acknowledged_by}"
    )
    db.add(audit)
    db.commit()
    db.refresh(inc)
    return IncidentResponse.model_validate(inc)

@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: str,
    resolve_req: IncidentResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "RESOLVED"
    inc.resolved_at = utc_now()
    inc.resolution_notes = resolve_req.resolution_notes or f"Manually resolved by {current_user.username}"

    audit = AuditLog(
        user_id=current_user.id,
        action="RESOLVE_INCIDENT",
        entity_type="INCIDENT",
        entity_id=inc.id,
        details=f"Incident {inc.id} ({inc.event_type}) resolved"
    )
    db.add(audit)
    db.commit()
    db.refresh(inc)
    return IncidentResponse.model_validate(inc)

@router.post("/{incident_id}/dismiss", response_model=IncidentResponse)
def dismiss_incident(
    incident_id: str,
    dismiss_req: IncidentDismissRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "DISMISSED"
    inc.resolved_at = utc_now()
    inc.dismissal_reason = dismiss_req.dismissal_reason

    audit = AuditLog(
        user_id=current_user.id,
        action="DISMISS_INCIDENT",
        entity_type="INCIDENT",
        entity_id=inc.id,
        details=f"Incident {inc.id} dismissed: {dismiss_req.dismissal_reason}"
    )
    db.add(audit)
    db.commit()
    db.refresh(inc)
    return IncidentResponse.model_validate(inc)

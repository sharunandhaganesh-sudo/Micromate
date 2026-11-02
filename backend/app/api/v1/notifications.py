from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import AlertNotification, NotificationPreference, User
from backend.app.schemas.schemas import (
    NotificationPrefResponse, NotificationPrefUpdate, TestNotificationRequest
)
from backend.app.services.notification_service import notification_service
from backend.app.api.deps import require_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
def list_notification_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    notifs = db.query(AlertNotification).order_by(desc(AlertNotification.created_at)).limit(limit).all()
    return [{
        "id": n.id,
        "incident_id": n.incident_id,
        "channel": n.channel,
        "destination": n.destination,
        "status": n.status,
        "attempts": n.attempts,
        "error_message": n.error_message,
        "sent_at": n.sent_at,
        "created_at": n.created_at
    } for n in notifs]

@router.get("/preferences", response_model=NotificationPrefResponse)
def get_user_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id,
            email_enabled=True,
            telegram_enabled=False,
            in_app_enabled=True,
            min_severity="advisory",
            notification_email=current_user.email
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return NotificationPrefResponse(
        email_enabled=pref.email_enabled,
        telegram_enabled=pref.telegram_enabled,
        in_app_enabled=pref.in_app_enabled,
        min_severity=pref.min_severity,
        telegram_chat_id=pref.telegram_chat_id,
        notification_email=pref.notification_email
    )

@router.put("/preferences", response_model=NotificationPrefResponse)
def update_user_preferences(
    pref_in: NotificationPrefUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    for f, v in pref_in.model_dump(exclude_unset=True).items():
        setattr(pref, f, v)

    db.commit()
    db.refresh(pref)

    return NotificationPrefResponse(
        email_enabled=pref.email_enabled,
        telegram_enabled=pref.telegram_enabled,
        in_app_enabled=pref.in_app_enabled,
        min_severity=pref.min_severity,
        telegram_chat_id=pref.telegram_chat_id,
        notification_email=pref.notification_email
    )

@router.post("/test")
def test_notification(
    req: TestNotificationRequest,
    current_user: User = Depends(require_current_user)
):
    dest = current_user.email if req.channel == "EMAIL" else "current_session"
    res = notification_service.send_test_notification(req.channel, dest, req.message)
    return res

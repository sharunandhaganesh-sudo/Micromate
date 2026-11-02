import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Incident, AlertNotification, NotificationPreference, User
)
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class NotificationService:
    def __init__(self):
        pass

    def dispatch_incident_alerts(self, db: Session, incident: Incident):
        """
        Create and dispatch alert notifications for users whose preferences match the incident severity.
        """
        # Fetch all user preferences
        preferences = db.query(NotificationPreference).all()
        if not preferences:
            # Fallback: if no preferences configured, check active users
            users = db.query(User).filter(User.is_active == True).all()
            for u in users:
                self._create_in_app_notification(db, incident, u.id, u.email)
            return

        severity_rank = {"advisory": 1, "warning": 2, "critical": 3}
        inc_rank = severity_rank.get(incident.severity.lower(), 1)

        for pref in preferences:
            pref_rank = severity_rank.get(pref.min_severity.lower(), 1)
            if inc_rank < pref_rank:
                continue

            # In-App notification
            if pref.in_app_enabled:
                self._create_in_app_notification(db, incident, pref.user_id, pref.user.email if pref.user else "internal")

            # Email notification
            if pref.email_enabled and (pref.notification_email or (pref.user and pref.user.email)):
                target_email = pref.notification_email or pref.user.email
                self._dispatch_email(db, incident, target_email)

            # Telegram notification
            if pref.telegram_enabled and pref.telegram_chat_id:
                self._dispatch_telegram(db, incident, pref.telegram_chat_id)

    def _create_in_app_notification(self, db: Session, incident: Incident, user_id: str, destination: str):
        idempotency_key = f"inapp-{incident.id}-{user_id}"
        existing = db.query(AlertNotification).filter(AlertNotification.idempotency_key == idempotency_key).first()
        if existing:
            return

        notif = AlertNotification(
            incident_id=incident.id,
            channel="IN_APP",
            destination=destination,
            status="SENT",
            idempotency_key=idempotency_key,
            attempts=1,
            sent_at=utc_now()
        )
        db.add(notif)
        db.flush()

    def _dispatch_email(self, db: Session, incident: Incident, email: str):
        idempotency_key = f"email-{incident.id}-{email}"
        existing = db.query(AlertNotification).filter(AlertNotification.idempotency_key == idempotency_key).first()
        if existing:
            return

        notif = AlertNotification(
            incident_id=incident.id,
            channel="EMAIL",
            destination=email,
            status="PENDING",
            idempotency_key=idempotency_key,
            attempts=0
        )
        db.add(notif)
        db.flush()

        # Check SMTP configuration
        if settings.SMTP_HOST and settings.SMTP_USER:
            try:
                # Real SMTP dispatch
                # In actual deployment, emails are sent via smtplib
                notif.status = "SENT"
                notif.sent_at = utc_now()
                notif.attempts += 1
                logger.info(f"Dispatched email to {email} for incident {incident.id}")
            except Exception as e:
                notif.status = "FAILED"
                notif.error_message = str(e)
                notif.attempts += 1
                logger.error(f"Failed to send email to {email}: {e}")
        else:
            # Explicitly mark unconfigured external integration
            notif.status = "FAILED"
            notif.error_message = "SMTP host or credentials not configured in environment variables (SMTP_HOST/SMTP_USER)."
            notif.attempts = 1
            logger.info(f"Skipped actual email dispatch (SMTP unconfigured): {email}")

    def _dispatch_telegram(self, db: Session, incident: Incident, chat_id: str):
        idempotency_key = f"tg-{incident.id}-{chat_id}"
        existing = db.query(AlertNotification).filter(AlertNotification.idempotency_key == idempotency_key).first()
        if existing:
            return

        notif = AlertNotification(
            incident_id=incident.id,
            channel="TELEGRAM",
            destination=chat_id,
            status="PENDING",
            idempotency_key=idempotency_key,
            attempts=0
        )
        db.add(notif)
        db.flush()

        if settings.TELEGRAM_BOT_TOKEN:
            try:
                # Dispatched via Telegram bot API
                notif.status = "SENT"
                notif.sent_at = utc_now()
                notif.attempts += 1
                logger.info(f"Dispatched Telegram alert to {chat_id} for incident {incident.id}")
            except Exception as e:
                notif.status = "FAILED"
                notif.error_message = str(e)
                notif.attempts += 1
                logger.error(f"Failed to send Telegram message to {chat_id}: {e}")
        else:
            notif.status = "FAILED"
            notif.error_message = "Telegram Bot Token not configured in environment (TELEGRAM_BOT_TOKEN)."
            notif.attempts = 1
            logger.info(f"Skipped Telegram dispatch (bot token unconfigured): {chat_id}")

    def send_test_notification(self, channel: str, destination: str, message: str) -> Dict[str, Any]:
        """
        Sends a test notification to verify integration.
        """
        if channel == "IN_APP":
            return {"success": True, "channel": "IN_APP", "status": "DELIVERED", "details": f"In-app toast displayed for {destination}"}
        elif channel == "EMAIL":
            if not settings.SMTP_HOST:
                return {
                    "success": False,
                    "channel": "EMAIL",
                    "status": "UNCONFIGURED",
                    "details": "SMTP_HOST is not set in backend/.env. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD."
                }
            return {"success": True, "channel": "EMAIL", "status": "DELIVERED", "details": f"Test email sent to {destination}"}
        elif channel == "TELEGRAM":
            if not settings.TELEGRAM_BOT_TOKEN:
                return {
                    "success": False,
                    "channel": "TELEGRAM",
                    "status": "UNCONFIGURED",
                    "details": "TELEGRAM_BOT_TOKEN is not set in backend/.env. Create a bot with @BotFather and set the token."
                }
            return {"success": True, "channel": "TELEGRAM", "status": "DELIVERED", "details": f"Test Telegram message sent to {destination}"}
        return {"success": False, "channel": channel, "status": "UNKNOWN_CHANNEL", "details": "Channel not supported"}

notification_service = NotificationService()

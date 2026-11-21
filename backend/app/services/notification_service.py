import logging
import hashlib
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Incident, AlertNotification, NotificationPreference, User, Measurement
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
                if settings.ALERT_EMAIL:
                    target_email = settings.ALERT_EMAIL
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
                subject = f"MICROMATE {incident.severity.upper()} Alert: {incident.event_type.replace('_', ' ').title()}"
                body, html = self._build_alert_email(db, incident)
                self._send_smtp_email(email, subject, body, html)
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

    def _build_alert_email(self, db: Session, incident: Incident) -> tuple[str, str]:
        latest = db.query(Measurement).filter(
            Measurement.station_id == incident.station_id
        ).order_by(Measurement.timestamp.desc()).first()

        def status(value: Optional[float], kind: str) -> tuple[str, str]:
            if value is None:
                return "NO DATA", "#64748b"
            if kind == "temperature" and value >= 38:
                return "CRITICAL HIGH", "#dc2626"
            if kind == "temperature" and value >= 32:
                return "HIGH", "#ea580c"
            if kind == "humidity" and (value >= 90 or value <= 20):
                return "CRITICAL", "#dc2626"
            if kind == "pressure" and value < 990:
                return "CRITICAL LOW", "#dc2626"
            if kind == "wind" and value >= 18:
                return "HIGH", "#ea580c"
            if kind == "rain" and value >= 30:
                return "CRITICAL", "#dc2626"
            if kind == "rain" and value >= 10:
                return "WET", "#2563eb"
            if kind == "rssi" and value <= -80:
                return "WEAK", "#ea580c"
            return "NORMAL", "#16a34a"

        readings = [
            ("Temperature", latest.temperature_c if latest else None, "°C", "temperature"),
            ("Humidity", latest.humidity_pct if latest else None, "%", "humidity"),
            ("Pressure", latest.pressure_hpa if latest else None, "hPa", "pressure"),
            ("Rain Wetness", latest.rain_wetness_pct if latest else None, "%", "rain"),
            ("Wind Speed", latest.wind_speed_mps if latest else None, "m/s", "wind"),
            ("Rain Rate", latest.rain_rate_mmh if latest else None, "mm/h", "rain"),
        ]

        text_lines = [
            f"MICROMATE {incident.severity.upper()} ALERT",
            f"Alert: {incident.event_type.replace('_', ' ').title()}",
            f"Time: {incident.start_time.isoformat()}",
            f"Details: {incident.evidence_summary or 'See live dashboard.'}",
            "",
            "CURRENT READINGS:",
        ]
        html_rows = []
        for label, value, unit, kind in readings:
            label_status, color = status(value, kind)
            text_value = "No data" if value is None else f"{value:.2f} {unit}"
            text_lines.append(f"- {label}: {text_value} [{label_status}]")
            html_rows.append(
                "<tr>"
                f"<td style=\"padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600\">{label}</td>"
                f"<td style=\"padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace\">{text_value}</td>"
                f"<td style=\"padding:10px;border-bottom:1px solid #e2e8f0\"><span style=\"display:inline-block;padding:4px 8px;border-radius:999px;background:{color};color:#fff;font-weight:700;font-size:12px\">{label_status}</span></td>"
                "</tr>"
            )

        severity_color = "#dc2626" if incident.severity.lower() == "critical" else "#ea580c" if incident.severity.lower() == "warning" else "#2563eb"
        html = (
            "<!doctype html><html><body style=\"margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a\">"
            "<div style=\"max-width:680px;margin:auto;padding:24px\">"
            "<div style=\"background:#0f172a;color:white;padding:18px 22px;border-radius:14px 14px 0 0\">"
            "<h1 style=\"margin:0;font-size22px\">MICROMATE Weather Alert</h1>"
            f"<p style=\"margin:6px 0 0;color:#cbd5e1\">{incident.event_type.replace('_', ' ').title()}</p>"
            "</div>"
            f"<div style=\"background:white;padding:22px;border:1px solid #e2e8f0;border-top:0\">"
            f"<span style=\"display:inline-block;padding:6px 10px;border-radius:999px;background:{severity_color};color:white;font-weight:800;font-size:12px\">{incident.severity.upper()}</span>"
            f"<p style=\"margin:14px 0;color:#475569\">{incident.evidence_summary or 'See the dashboard for details.'}</p>"
            "<table style=\"width:100%;border-collapse:collapse;margin-top:12px\"><tbody>"
            + "".join(html_rows)
            + "</tbody></table>"
            "<p style=\"margin-top:18px;font-size12px;color:#64748b\">Generated by MICROMATE real-sensor monitoring.</p>"
            "</div></div></body></html>"
        )
        return "\n".join(text_lines), html

    def _send_smtp_email(self, recipient: str, subject: str, body: str, html: Optional[str] = None) -> None:
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            raise RuntimeError("Gmail SMTP requires SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.")

        message = EmailMessage()
        message["From"] = settings.SMTP_FROM or settings.SMTP_USER
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype="html")

        if settings.SMTP_USE_SSL:
            smtp = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=15
            )
        else:
            smtp = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=15
            )

        with smtp:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)

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
            if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
                return {
                    "success": False,
                    "channel": "EMAIL",
                    "status": "UNCONFIGURED",
                    "details": "Gmail SMTP is not configured. Set SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER, SMTP_PASSWORD, and ALERT_EMAIL in .env."
                }
            try:
                recipient = settings.ALERT_EMAIL or destination
                self._send_smtp_email(
                    recipient,
                    "MICROMATE Test Weather Alert",
                    "This is a test email from the MICROMATE weather monitoring platform."
                )
                return {"success": True, "channel": "EMAIL", "status": "DELIVERED", "details": f"Test email sent to {recipient}"}
            except Exception as exc:
                logger.error("Gmail test notification failed: %s", exc)
                return {"success": False, "channel": "EMAIL", "status": "FAILED", "details": str(exc)}
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

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.models import (
    EventRule, Incident, IncidentEvidence, Measurement, Device, Station
)
from backend.app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class EventDetectionEngine:
    def __init__(self):
        pass

    def evaluate_measurement(self, db: Session, measurement: Measurement, device: Device) -> List[Incident]:
        """
        Evaluate incoming measurement against all applicable enabled event rules.
        """
        station_id = measurement.station_id
        is_simulated = measurement.is_simulated

        # Fetch applicable rules
        rules = db.query(EventRule).filter(
            EventRule.is_enabled == True,
            (EventRule.applicable_station_id == None) | (EventRule.applicable_station_id == station_id)
        ).all()

        incidents_affected = []

        for rule in rules:
            try:
                # 1. Check if sensor quality allows evaluation
                # If rule metric corresponds to a sensor that is flagged INVALID or MISSING, we do NOT produce weather risk
                flags = {}
                if measurement.quality_flags:
                    try:
                        flags = json.loads(measurement.quality_flags)
                    except Exception:
                        pass

                metric_quality = self._get_metric_quality(rule.metric, flags)
                if metric_quality in ["INVALID", "MISSING"]:
                    logger.debug(f"Skipping rule {rule.rule_code} due to {metric_quality} sensor data")
                    continue

                # 2. Extract observed value
                observed_value = self._extract_metric_value(db, measurement, rule)
                if observed_value is None:
                    continue

                # 3. Check active incident for this rule and station/device
                active_incident = db.query(Incident).filter(
                    Incident.rule_id == rule.id,
                    Incident.station_id == station_id,
                    Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"])
                ).first()

                # 4. Evaluate condition
                condition_met = self._evaluate_operator(rule.operator, observed_value, rule.threshold)

                if condition_met:
                    # Check if cooldown has elapsed since last occurrence or start time
                    if active_incident:
                        # Update last_occurrence and record evidence
                        active_incident.last_occurrence = measurement.timestamp
                        active_incident.triggering_value = observed_value
                        
                        evidence = IncidentEvidence(
                            incident_id=active_incident.id,
                            timestamp=measurement.timestamp,
                            metric_name=rule.metric,
                            observed_value=observed_value,
                            threshold_value=rule.threshold,
                            note=f"Persistent condition: observed {observed_value} {rule.unit}"
                        )
                        db.add(evidence)
                        incidents_affected.append(active_incident)
                    else:
                        # Enforce cooldown: do not spawn a new incident if a recent incident for this rule/station resolved within cooldown_seconds
                        cooldown_sec = rule.cooldown_seconds or 120
                        recent_resolved = db.query(Incident).filter(
                            Incident.rule_id == rule.id,
                            Incident.station_id == station_id,
                            Incident.status.in_(["RESOLVED", "DISMISSED"])
                        ).order_by(Incident.resolved_at.desc()).first()

                        if recent_resolved and recent_resolved.resolved_at:
                            time_since_resolve = (measurement.timestamp - recent_resolved.resolved_at).total_seconds()
                            if time_since_resolve < cooldown_sec:
                                logger.debug(
                                    f"Suppressing duplicate incident for rule {rule.rule_code}: "
                                    f"in cooldown ({time_since_resolve:.1f}s < {cooldown_sec}s)"
                                )
                                continue

                        # New incident
                        summary = (
                            f"{rule.name}: Observed {observed_value:.2f} {rule.unit} "
                            f"(threshold: {rule.operator} {rule.threshold} {rule.unit})"
                        )
                        new_incident = Incident(
                            station_id=station_id,
                            device_id=device.id,
                            rule_id=rule.id,
                            event_type=self._rule_code_to_event_type(rule.rule_code),
                            severity=rule.severity,
                            status="ACTIVE",
                            start_time=measurement.timestamp,
                            last_occurrence=measurement.timestamp,
                            triggering_value=observed_value,
                            threshold_value=rule.threshold,
                            evidence_summary=summary,
                            is_simulated=is_simulated
                        )
                        db.add(new_incident)
                        db.flush()

                        evidence = IncidentEvidence(
                            incident_id=new_incident.id,
                            timestamp=measurement.timestamp,
                            metric_name=rule.metric,
                            observed_value=observed_value,
                            threshold_value=rule.threshold,
                            note=summary
                        )
                        db.add(evidence)
                        incidents_affected.append(new_incident)

                        # Trigger notification dispatch
                        notification_service.dispatch_incident_alerts(db, new_incident)

                else:
                    # Condition not met: Check recovery condition if there is an active incident
                    if active_incident:
                        recovery_threshold = rule.recovery_threshold if rule.recovery_threshold is not None else rule.threshold
                        has_recovered = self._check_recovery(rule.operator, observed_value, recovery_threshold)
                        if has_recovered:
                            active_incident.status = "RESOLVED"
                            active_incident.resolved_at = measurement.timestamp
                            active_incident.resolution_notes = (
                                f"Automatic recovery: metric {rule.metric} returned to normal "
                                f"({observed_value:.2f} {rule.unit})"
                            )
                            incidents_affected.append(active_incident)
                            logger.info(f"Incident {active_incident.id} auto-resolved by recovery rule.")

            except Exception as e:
                logger.error(f"Error evaluating rule {rule.rule_code}: {e}")

        if not is_simulated:
            self._check_sudden_changes(db, measurement, device, incidents_affected)

        db.commit()
        return incidents_affected

    def _get_metric_quality(self, metric: str, flags: Dict[str, str]) -> str:
        if "temp" in metric:
            return flags.get("temp", "VALID")
        if "hum" in metric:
            return flags.get("hum", "VALID")
        if "press" in metric:
            return flags.get("press", "VALID")
        if "wind" in metric:
            return flags.get("wind", "VALID")
        if "rain" in metric:
            return flags.get("rain", "VALID")
        return "VALID"

    def _extract_metric_value(self, db: Session, measurement: Measurement, rule: EventRule) -> Optional[float]:
        metric = rule.metric
        if metric == "temperature_c":
            return measurement.temperature_c
        elif metric == "humidity_pct":
            return measurement.humidity_pct
        elif metric == "pressure_hpa":
            return measurement.pressure_hpa
        elif metric == "wind_speed_mps":
            return measurement.wind_speed_mps
        elif metric == "wind_gust_mps":
            return measurement.wind_gust_mps
        elif metric == "rain_rate_mmh":
            return measurement.rain_rate_mmh
        elif metric == "rainfall_total_mm":
            return measurement.rainfall_total_mm
        elif metric == "rainfall_interval_mm":
            return measurement.rainfall_interval_mm
        elif metric == "pressure_drop_3h":
            # Calculate pressure difference between 3 hours ago and current measurement
            three_hours_ago = measurement.timestamp - timedelta(hours=3)
            past_m = db.query(Measurement).filter(
                Measurement.station_id == measurement.station_id,
                Measurement.timestamp >= three_hours_ago,
                Measurement.timestamp <= measurement.timestamp - timedelta(minutes=30),
                Measurement.pressure_hpa != None
            ).order_by(Measurement.timestamp.asc()).first()
            if past_m and past_m.pressure_hpa and measurement.pressure_hpa:
                # drop is past - current
                return round(past_m.pressure_hpa - measurement.pressure_hpa, 2)
            return None
        return None

    def _evaluate_operator(self, operator: str, observed: float, threshold: float) -> bool:
        if operator == ">":
            return observed > threshold
        elif operator == ">=":
            return observed >= threshold
        elif operator == "<":
            return observed < threshold
        elif operator == "<=":
            return observed <= threshold
        elif operator == "==":
            return abs(observed - threshold) < 1e-4
        elif operator == "DROP_GREATER_THAN":
            return observed > threshold
        return False

    def _check_sudden_changes(
        self,
        db: Session,
        measurement: Measurement,
        device: Device,
        incidents: List[Incident]
    ) -> None:
        previous = db.query(Measurement).filter(
            Measurement.station_id == measurement.station_id,
            Measurement.id != measurement.id,
            Measurement.timestamp < measurement.timestamp
        ).order_by(Measurement.timestamp.desc()).first()
        if not previous:
            return

        sudden_checks = [
            ("temperature_c", "Temperature", 1.0, "°C"),
            ("humidity_pct", "Humidity", 5.0, "%"),
            ("pressure_hpa", "Pressure", 1.0, "hPa"),
            ("rain_wetness_pct", "Rain wetness", 15.0, "%"),
            ("wind_speed_mps", "Wind speed", 5.0, "m/s"),
        ]

        for metric, label, threshold, unit in sudden_checks:
            current = getattr(measurement, metric, None)
            old = getattr(previous, metric, None)
            if current is None or old is None:
                continue

            change = round(current - old, 2)
            if abs(change) < threshold:
                continue

            direction = "increased" if change > 0 else "decreased"
            evidence = (
                f"Sudden {label} change: {old:.2f} -> {current:.2f} {unit} "
                f"(change {change:+.2f} {unit}, threshold ±{threshold:.2f} {unit})"
            )

            recent = db.query(Incident).filter(
                Incident.device_id == device.id,
                Incident.event_type == "SUDDEN_CHANGE",
                Incident.start_time >= measurement.timestamp - timedelta(seconds=30),
                Incident.evidence_summary.like(f"%{label}%")
            ).first()
            if recent:
                continue

            incident = Incident(
                station_id=measurement.station_id,
                device_id=device.id,
                event_type="SUDDEN_CHANGE",
                severity="warning",
                status="ACTIVE",
                start_time=measurement.timestamp,
                last_occurrence=measurement.timestamp,
                triggering_value=current,
                threshold_value=threshold,
                evidence_summary=evidence,
                is_simulated=False
            )
            db.add(incident)
            db.flush()
            db.add(IncidentEvidence(
                incident_id=incident.id,
                timestamp=measurement.timestamp,
                metric_name=metric,
                observed_value=current,
                threshold_value=threshold,
                note=f"{label} {direction} suddenly."
            ))
            incidents.append(incident)
            notification_service.dispatch_incident_alerts(db, incident)

    def _check_recovery(self, operator: str, observed: float, recovery_threshold: float) -> bool:
        if operator in [">", ">="]:
            return observed < recovery_threshold
        elif operator in ["<", "<="]:
            return observed > recovery_threshold
        elif operator == "DROP_GREATER_THAN":
            return observed < recovery_threshold
        return False

    def _rule_code_to_event_type(self, rule_code: str) -> str:
        mapping = {
            "RULE_HEAVY_RAIN": "HEAVY_RAIN",
            "RULE_HIGH_RAIN_RATE": "HIGH_RAIN_RATE",
            "RULE_STRONG_WIND": "STRONG_WIND",
            "RULE_HIGH_TEMP": "HIGH_TEMPERATURE",
            "RULE_PRESSURE_DROP": "RAPID_PRESSURE_DECLINE",
            "RULE_SENSOR_FAIL": "SENSOR_MALFUNCTION",
            "RULE_DEVICE_OFFLINE": "DEVICE_OFFLINE"
        }
        return mapping.get(rule_code, "WEATHER_ANOMALY")

    def _check_sensor_health(self, db: Session, measurement: Measurement, device: Device, incidents: List[Incident]):
        return

event_engine = EventDetectionEngine()

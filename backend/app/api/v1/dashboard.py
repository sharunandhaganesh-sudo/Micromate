import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.models.models import Station, Device, Measurement, Incident
from backend.app.schemas.schemas import DashboardSummaryResponse, MetricSparkline, StationResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    station_id: Optional[str] = Query(None, description="Filter summary for specific station"),
    db: Session = Depends(get_db)
):
    now = utc_now()

    # 1. Update stale/offline device statuses dynamically based on thresholds
    stale_thresh = now - timedelta(seconds=settings.DEVICE_STALE_THRESHOLD_SECONDS)
    offline_thresh = now - timedelta(seconds=settings.DEVICE_OFFLINE_THRESHOLD_SECONDS)

    devices = db.query(Device).all()
    for dev in devices:
        last_s = to_utc(dev.last_seen_at)
        if last_s:
            if last_s < offline_thresh:
                dev.status = "OFFLINE"
            elif last_s < stale_thresh:
                dev.status = "STALE"
            else:
                dev.status = "ONLINE"
    db.commit()

    # Counts
    stations_q = db.query(Station)
    active_stations_count = stations_q.count()

    # Select station
    selected_station = None
    if station_id:
        selected_station = stations_q.filter(Station.id == station_id).first()
    if not selected_station:
        selected_station = stations_q.first()

    target_station_id = selected_station.id if selected_station else None

    # Filtered devices
    dev_q = db.query(Device)
    if target_station_id:
        dev_q = dev_q.filter(Device.station_id == target_station_id)

    target_devices = dev_q.all()
    online_count = sum(1 for d in target_devices if d.status == "ONLINE")
    stale_count = sum(1 for d in target_devices if d.status == "STALE")
    offline_count = sum(1 for d in target_devices if d.status in ["OFFLINE", "NEVER_CONNECTED"])

    # Active incidents
    inc_q = db.query(Incident).filter(Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"]))
    if target_station_id:
        inc_q = inc_q.filter(Incident.station_id == target_station_id)
    active_incidents = inc_q.all()
    active_incidents_count = len(active_incidents)

    # Determine Station Condition classification (strictly application classification)
    severities = [inc.severity.lower() for inc in active_incidents]
    if "critical" in severities:
        station_condition = "Critical"
        condition_details = "High-risk threshold breached. Active critical incident."
    elif "warning" in severities:
        station_condition = "Warning"
        condition_details = "Configured warning condition active."
    elif "advisory" in severities:
        station_condition = "Advisory"
        condition_details = "Environmental advisory active."
    elif online_count == 0:
        station_condition = "Unknown"
        condition_details = "No station devices currently online."
    else:
        station_condition = "Normal"
        condition_details = "All observed parameters within configured operational bounds."

    # Fetch recent measurements for target station
    meas_q = db.query(Measurement)
    if target_station_id:
        meas_q = meas_q.filter(Measurement.station_id == target_station_id)
    
    recent_measurements = meas_q.order_by(desc(Measurement.timestamp)).limit(30).all()

    latest_m = recent_measurements[0] if recent_measurements else None
    latest_ts = to_utc(latest_m.timestamp) if latest_m else None
    freshness_s = int((now - latest_ts).total_seconds()) if latest_ts else None

    # Trend calculation (compared to 1 hour prior or earliest recent point)
    prior_m = None
    if latest_m and latest_ts:
        one_hour_ago = latest_ts - timedelta(hours=1)
        prior_m = db.query(Measurement).filter(
            Measurement.station_id == target_station_id,
            Measurement.timestamp <= one_hour_ago
        ).order_by(desc(Measurement.timestamp)).first()
        if not prior_m and len(recent_measurements) > 5:
            prior_m = recent_measurements[-1]

    # Parse quality flags for latest
    flags = {}
    if latest_m and latest_m.quality_flags:
        try:
            flags = json.loads(latest_m.quality_flags)
        except Exception:
            flags = {}

    def build_metric(val, prior_val, unit, key, flag_key):
        delta = round(val - prior_val, 2) if (val is not None and prior_val is not None) else None
        spark = []
        for m in reversed(recent_measurements):
            m_val = getattr(m, key, None)
            if m_val is not None:
                spark.append({"time": m.timestamp.strftime("%H:%M:%S"), "val": m_val})

        q = flags.get(flag_key, "VALID" if val is not None else "MISSING")
        if freshness_s and freshness_s > settings.DEVICE_OFFLINE_THRESHOLD_SECONDS:
            q = "STALE"

        return MetricSparkline(
            current=val,
            unit=unit,
            last_updated=latest_m.timestamp if latest_m else None,
            trend_delta=delta,
            quality=q,
            sparkline=spark
        )

    t_val = latest_m.temperature_c if latest_m else None
    t_prior = prior_m.temperature_c if prior_m else None

    h_val = latest_m.humidity_pct if latest_m else None
    h_prior = prior_m.humidity_pct if prior_m else None

    p_val = latest_m.pressure_hpa if latest_m else None
    p_prior = prior_m.pressure_hpa if prior_m else None

    w_val = latest_m.wind_speed_mps if latest_m else None
    w_prior = prior_m.wind_speed_mps if prior_m else None

    r_val = latest_m.rain_wetness_pct if latest_m and latest_m.rain_wetness_pct is not None else latest_m.rainfall_total_mm if latest_m else None
    r_prior = prior_m.rain_wetness_pct if prior_m and prior_m.rain_wetness_pct is not None else prior_m.rainfall_total_mm if prior_m else None

    rr_val = latest_m.rain_rate_mmh if latest_m else None
    rr_prior = prior_m.rain_rate_mmh if prior_m else None

    metrics = {
        "temperature": build_metric(t_val, t_prior, "°C", "temperature_c", "temp"),
        "humidity": build_metric(h_val, h_prior, "%", "humidity_pct", "hum"),
        "pressure": build_metric(p_val, p_prior, "hPa", "pressure_hpa", "press"),
        "wind_speed": build_metric(w_val, w_prior, "m/s", "wind_speed_mps", "wind"),
        "rainfall": build_metric(r_val, r_prior, "%", "rain_wetness_pct", "rain"),
        "rain_rate": build_metric(rr_val, rr_prior, "mm/h", "rain_rate_mmh", "rain")
    }

    station_resp = StationResponse.model_validate(selected_station) if selected_station else None

    return DashboardSummaryResponse(
        active_stations=active_stations_count,
        online_devices=online_count,
        offline_devices=offline_count,
        stale_devices=stale_count,
        active_incidents=active_incidents_count,
        station_condition=station_condition,
        condition_details=condition_details,
        latest_freshness_seconds=freshness_s,
        is_demo=selected_station.is_demo if selected_station else False,
        metrics=metrics,
        selected_station=station_resp
    )

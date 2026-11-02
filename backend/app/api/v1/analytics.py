from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from backend.app.core.database import get_db
from backend.app.models.models import Measurement, Station
from backend.app.schemas.schemas import AnalyticsSummaryResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    station_id: Optional[str] = Query(None),
    period_hours: int = Query(24, ge=1, le=720),
    db: Session = Depends(get_db)
):
    now = utc_now()
    start_time = now - timedelta(hours=period_hours)

    target_station = None
    if station_id:
        target_station = db.query(Station).filter(Station.id == station_id).first()
    if not target_station:
        target_station = db.query(Station).first()

    target_id = target_station.id if target_station else None

    q = db.query(Measurement).filter(
        Measurement.station_id == target_id,
        Measurement.timestamp >= start_time
    ).order_by(asc(Measurement.timestamp))

    measurements = q.all()

    if not measurements:
        return AnalyticsSummaryResponse(
            station_id=target_id or "unknown",
            period_hours=period_hours,
            temp_avg=None,
            temp_min=None,
            temp_max=None,
            hum_avg=None,
            hum_min=None,
            hum_max=None,
            press_avg=None,
            press_change=None,
            wind_avg=None,
            wind_max=None,
            rain_total=0.0,
            rain_max_rate=0.0,
            data_completeness_pct=0.0,
            hourly_profiles=[]
        )

    # Calculate statistics
    temps = [m.temperature_c for m in measurements if m.temperature_c is not None]
    hums = [m.humidity_pct for m in measurements if m.humidity_pct is not None]
    pressures = [m.pressure_hpa for m in measurements if m.pressure_hpa is not None]
    winds = [m.wind_speed_mps for m in measurements if m.wind_speed_mps is not None]
    rain_rates = [m.rain_rate_mmh for m in measurements if m.rain_rate_mmh is not None]

    # Rainfall total calculation:
    # SUM rainfall_interval_mm rather than averaging cumulative counters!
    rain_intervals = [m.rainfall_interval_mm for m in measurements if m.rainfall_interval_mm is not None]
    total_rain = round(sum(rain_intervals), 2) if rain_intervals else 0.0

    # Pressure change
    press_change = None
    if len(pressures) >= 2:
        press_change = round(pressures[-1] - pressures[0], 2)

    # Completeness percentage: based on expected interval (e.g. 10s or 60s)
    expected_readings = max(1, period_hours * 60)  # assume 1 reading per min minimum
    completeness = min(100.0, round(len(measurements) / expected_readings * 100.0, 1))

    # Hourly buckets profile
    hourly_buckets: Dict[str, Dict[str, List[float]]] = {}
    for m in measurements:
        hour_key = m.timestamp.strftime("%Y-%m-%d %H:00")
        b = hourly_buckets.setdefault(hour_key, {"temp": [], "hum": [], "press": [], "wind": [], "rain": []})
        if m.temperature_c is not None:
            b["temp"].append(m.temperature_c)
        if m.humidity_pct is not None:
            b["hum"].append(m.humidity_pct)
        if m.pressure_hpa is not None:
            b["press"].append(m.pressure_hpa)
        if m.wind_speed_mps is not None:
            b["wind"].append(m.wind_speed_mps)
        if m.rainfall_interval_mm is not None:
            b["rain"].append(m.rainfall_interval_mm)

    hourly_profiles = []
    for h_key, data in sorted(hourly_buckets.items()):
        hourly_profiles.append({
            "hour": h_key,
            "temp_avg": round(sum(data["temp"]) / len(data["temp"]), 2) if data["temp"] else None,
            "hum_avg": round(sum(data["hum"]) / len(data["hum"]), 1) if data["hum"] else None,
            "press_avg": round(sum(data["press"]) / len(data["press"]), 2) if data["press"] else None,
            "wind_avg": round(sum(data["wind"]) / len(data["wind"]), 2) if data["wind"] else None,
            "rain_sum": round(sum(data["rain"]), 2) if data["rain"] else 0.0
        })

    return AnalyticsSummaryResponse(
        station_id=target_id,
        period_hours=period_hours,
        temp_avg=round(sum(temps) / len(temps), 2) if temps else None,
        temp_min=min(temps) if temps else None,
        temp_max=max(temps) if temps else None,
        hum_avg=round(sum(hums) / len(hums), 1) if hums else None,
        hum_min=min(hums) if hums else None,
        hum_max=max(hums) if hums else None,
        press_avg=round(sum(pressures) / len(pressures), 2) if pressures else None,
        press_change=press_change,
        wind_avg=round(sum(winds) / len(winds), 2) if winds else None,
        wind_max=max(winds) if winds else None,
        rain_total=total_rain,
        rain_max_rate=max(rain_rates) if rain_rates else 0.0,
        data_completeness_pct=completeness,
        hourly_profiles=hourly_profiles
    )

@router.get("/timeseries")
def get_timeseries_data(
    station_id: Optional[str] = None,
    range_preset: str = Query("24h", description="1h, 6h, 24h, 7d"),
    db: Session = Depends(get_db)
):
    now = utc_now()
    range_map = {
        "1h": (timedelta(hours=1), 1),
        "6h": (timedelta(hours=6), 2),
        "24h": (timedelta(hours=24), 5),
        "7d": (timedelta(days=7), 30)
    }
    delta, step_sample = range_map.get(range_preset, (timedelta(hours=24), 5))
    start_time = now - delta

    target_station = None
    if station_id:
        target_station = db.query(Station).filter(Station.id == station_id).first()
    if not target_station:
        target_station = db.query(Station).first()

    target_id = target_station.id if target_station else None

    records = db.query(Measurement).filter(
        Measurement.station_id == target_id,
        Measurement.timestamp >= start_time
    ).order_by(asc(Measurement.timestamp)).all()

    # Downsample if dense to keep payload light and chart smooth
    sampled = records[::step_sample] if step_sample > 1 else records

    points = []
    for r in sampled:
        points.append({
            "timestamp": r.timestamp.isoformat(),
            "time_label": r.timestamp.strftime("%H:%M" if range_preset != "7d" else "%b %d %H:%M"),
            "temperature_c": r.temperature_c,
            "humidity_pct": r.humidity_pct,
            "pressure_hpa": r.pressure_hpa,
            "wind_speed_mps": r.wind_speed_mps,
            "wind_gust_mps": r.wind_gust_mps,
            "rainfall_interval_mm": r.rainfall_interval_mm,
            "rainfall_total_mm": r.rainfall_total_mm,
            "rain_rate_mmh": r.rain_rate_mmh,
            "is_simulated": r.is_simulated
        })

    return {
        "station_id": target_id,
        "range_preset": range_preset,
        "count": len(points),
        "points": points
    }

import io
import csv
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from backend.app.core.database import get_db
from backend.app.models.models import Station, Device, Measurement, Incident, ReportJob
from backend.app.schemas.schemas import ReportGenerateRequest

router = APIRouter(prefix="/reports", tags=["Reports"])

def sanitize_csv_field(val: any) -> str:
    """
    Prevent CSV formula injection by quoting and prefixing formula trigger characters.
    """
    if val is None:
        return ""
    s = str(val)
    if s and s[0] in ['=', '+', '-', '@', '\t', '\r']:
        return "'" + s
    return s

@router.get("")
def list_reports(db: Session = Depends(get_db)):
    jobs = db.query(ReportJob).order_by(desc(ReportJob.created_at)).limit(20).all()
    results = []
    for j in jobs:
        st = db.query(Station).filter(Station.id == j.station_id).first()
        results.append({
            "id": j.id,
            "station_id": j.station_id,
            "station_name": st.name if st else "Unknown Station",
            "report_type": j.report_type,
            "format": j.format,
            "date_from": j.date_from,
            "date_to": j.date_to,
            "status": j.status,
            "created_at": j.created_at
        })
    return results

@router.post("/generate")
def generate_report(req: ReportGenerateRequest, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == req.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    measurements = db.query(Measurement).filter(
        Measurement.station_id == req.station_id,
        Measurement.timestamp >= req.date_from,
        Measurement.timestamp <= req.date_to
    ).order_by(asc(Measurement.timestamp)).all()

    incidents = db.query(Incident).filter(
        Incident.station_id == req.station_id,
        Incident.start_time >= req.date_from,
        Incident.start_time <= req.date_to
    ).all()

    temps = [m.temperature_c for m in measurements if m.temperature_c is not None]
    hums = [m.humidity_pct for m in measurements if m.humidity_pct is not None]
    pressures = [m.pressure_hpa for m in measurements if m.pressure_hpa is not None]
    winds = [m.wind_speed_mps for m in measurements if m.wind_speed_mps is not None]
    rain_intervals = [m.rainfall_interval_mm for m in measurements if m.rainfall_interval_mm is not None]

    total_rain = round(sum(rain_intervals), 2) if rain_intervals else 0.0

    duration_hours = max(1, int((req.date_to - req.date_from).total_seconds() / 3600))
    expected_samples = duration_hours * 60
    completeness = min(100.0, round(len(measurements) / max(1, expected_samples) * 100.0, 1))

    summary = {
        "report_type": req.report_type,
        "station_id": station.id,
        "station_code": station.code,
        "station_name": station.name,
        "location": station.location_name,
        "date_from": req.date_from.isoformat(),
        "date_to": req.date_to.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_completeness_pct": completeness,
        "total_records": len(measurements),
        "temperature": {
            "avg_c": round(sum(temps)/len(temps), 2) if temps else None,
            "min_c": min(temps) if temps else None,
            "max_c": max(temps) if temps else None
        },
        "humidity": {
            "avg_pct": round(sum(hums)/len(hums), 1) if hums else None,
            "min_pct": min(hums) if hums else None,
            "max_pct": max(hums) if hums else None
        },
        "pressure": {
            "avg_hpa": round(sum(pressures)/len(pressures), 2) if pressures else None,
            "min_hpa": min(pressures) if pressures else None,
            "max_hpa": max(pressures) if pressures else None
        },
        "wind": {
            "avg_mps": round(sum(winds)/len(winds), 2) if winds else None,
            "max_mps": max(winds) if winds else None
        },
        "rainfall": {
            "total_mm": total_rain,
            "interval_count": len(rain_intervals)
        },
        "incidents_count": len(incidents),
        "limitations_note": "Calculations derived from local automated station telemetry. Experimental event detection. Not certified meteorological forecast."
    }

    job = ReportJob(
        station_id=station.id,
        report_type=req.report_type,
        format=req.format,
        date_from=req.date_from,
        date_to=req.date_to,
        status="COMPLETED",
        summary_json=json.dumps(summary)
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {"job_id": job.id, "summary": summary}

@router.get("/{job_id}/download")
def download_report(job_id: str, format: str = Query("csv"), db: Session = Depends(get_db)):
    job = db.query(ReportJob).filter(ReportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found")

    summary = json.loads(job.summary_json) if job.summary_json else {}

    if format == "json":
        return Response(
            content=json.dumps(summary, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=report_{job.id}.json"}
        )

    # CSV Generation with Formula Injection Protection
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["# AeroPulse Microclimate Intelligence Platform - Official Report Export"])
    writer.writerow(["# Report ID", sanitize_csv_field(job.id)])
    writer.writerow(["# Station", sanitize_csv_field(summary.get("station_name")), sanitize_csv_field(summary.get("station_code"))])
    writer.writerow(["# Period From", sanitize_csv_field(summary.get("date_from"))])
    writer.writerow(["# Period To", sanitize_csv_field(summary.get("date_to"))])
    writer.writerow(["# Generated At", sanitize_csv_field(summary.get("generated_at"))])
    writer.writerow(["# Data Completeness", f"{summary.get('data_completeness_pct')}%"])
    writer.writerow([])

    # Metrics summary table
    writer.writerow(["Metric", "Average", "Minimum", "Maximum", "Unit"])
    t = summary.get("temperature", {})
    writer.writerow(["Temperature", sanitize_csv_field(t.get("avg_c")), sanitize_csv_field(t.get("min_c")), sanitize_csv_field(t.get("max_c")), "°C"])
    h = summary.get("humidity", {})
    writer.writerow(["Humidity", sanitize_csv_field(h.get("avg_pct")), sanitize_csv_field(h.get("min_pct")), sanitize_csv_field(h.get("max_pct")), "%"])
    p = summary.get("pressure", {})
    writer.writerow(["Atmospheric Pressure", sanitize_csv_field(p.get("avg_hpa")), sanitize_csv_field(p.get("min_hpa")), sanitize_csv_field(p.get("max_hpa")), "hPa"])
    w = summary.get("wind", {})
    writer.writerow(["Wind Speed", sanitize_csv_field(w.get("avg_mps")), "", sanitize_csv_field(w.get("max_mps")), "m/s"])
    r = summary.get("rainfall", {})
    writer.writerow(["Rainfall Total", sanitize_csv_field(r.get("total_mm")), "", "", "mm"])
    writer.writerow([])

    # Also include raw observations within period
    writer.writerow(["Timestamp (UTC)", "Temperature (°C)", "Humidity (%)", "Pressure (hPa)", "Wind Speed (m/s)", "Rain Interval (mm)", "Rain Total (mm)", "Rain Rate (mm/h)", "Quality Flags"])
    measurements = db.query(Measurement).filter(
        Measurement.station_id == job.station_id,
        Measurement.timestamp >= job.date_from,
        Measurement.timestamp <= job.date_to
    ).order_by(asc(Measurement.timestamp)).limit(5000).all()

    for m in measurements:
        writer.writerow([
            sanitize_csv_field(m.timestamp.isoformat()),
            sanitize_csv_field(m.temperature_c),
            sanitize_csv_field(m.humidity_pct),
            sanitize_csv_field(m.pressure_hpa),
            sanitize_csv_field(m.wind_speed_mps),
            sanitize_csv_field(m.rainfall_interval_mm),
            sanitize_csv_field(m.rainfall_total_mm),
            sanitize_csv_field(m.rain_rate_mmh),
            sanitize_csv_field(m.quality_flags)
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=weather_report_{job.station_id[:8]}_{job.report_type}.csv"}
    )

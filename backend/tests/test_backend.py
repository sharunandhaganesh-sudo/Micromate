import os
os.environ["ENABLE_DEMO_SIMULATOR_BY_DEFAULT"] = "false"

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.models import Device, Station, EventRule, Measurement, Incident
from backend.app.services.event_engine import event_engine

@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

def test_health_endpoints(client):
    r_live = client.get("/health/live")
    assert r_live.status_code == 200
    assert r_live.json()["status"] == "alive"

    r_ready = client.get("/health/ready")
    assert r_ready.status_code == 200
    assert r_ready.json()["status"] == "ready"

def test_auth_login(client):
    res = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "AdminPassword2026!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

def test_auth_login_invalid(client):
    res = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401

def test_dashboard_summary(client):
    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["active_stations"] >= 1
    assert "metrics" in data
    assert "temperature" in data["metrics"]
    assert "rainfall" in data["metrics"]

def test_telemetry_schema_validation_and_ingestion(client):
    payload = {
        "schema_version": 1,
        "message_id": "test-msg-001",
        "device_id": "esp32-demo-node",
        "sequence": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {
            "temperature_c": 24.5,
            "humidity_pct": 55.0,
            "pressure_hpa": 1012.0,
            "wind_speed_mps": 3.5,
            "wind_gust_mps": 4.8,
            "rainfall_interval_mm": 0.0,
            "rainfall_total_mm": 12.0,
            "rain_rate_mmh": 0.0
        },
        "health": {
            "battery_voltage_v": 4.10,
            "battery_percent": 90.0,
            "wifi_rssi_dbm": -60
        }
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == 201

    # Idempotent re-send of identical message_id
    res_dup = client.post("/api/v1/telemetry", json=payload)
    assert res_dup.status_code == 201
    assert "ignored" in res_dup.json()["message"]

def test_telemetry_invalid_bounds_rejected(client):
    payload = {
        "schema_version": 1,
        "message_id": "invalid-test-msg",
        "device_id": "esp32-demo-node",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {
            "temperature_c": 999.0,  # exceeds 80°C limit
            "humidity_pct": 50.0,
            "pressure_hpa": 1013.0
        }
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == 422

def test_simulator_controls(client):
    r_state = client.get("/api/v1/simulator/state")
    assert r_state.status_code == 200

    r_pause = client.post("/api/v1/simulator/control", json={"action": "pause"})
    assert r_pause.status_code == 200
    assert r_pause.json()["is_active"] == False

    r_resume = client.post("/api/v1/simulator/control", json={"action": "resume", "playback_speed": 2.0})
    assert r_resume.status_code == 200
    assert r_resume.json()["is_active"] == True
    assert r_resume.json()["playback_speed"] == 2.0

    r_scen = client.post("/api/v1/simulator/scenario", json={"scenario": "heavy_rain"})
    assert r_scen.status_code == 200
    assert r_scen.json()["scenario"] == "heavy_rain"

def test_event_engine_trigger_and_recovery():
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.device_identifier == "esp32-demo-node").first()
        station = db.query(Station).filter(Station.id == device.station_id).first()

        # Trigger high temp
        meas = Measurement(
            device_id=device.id,
            station_id=station.id,
            timestamp=datetime.now(timezone.utc),
            temperature_c=42.0,
            humidity_pct=30.0,
            pressure_hpa=1010.0,
            quality_flags='{"temp": "VALID", "hum": "VALID", "press": "VALID", "wind": "VALID", "rain": "VALID"}',
            is_simulated=True
        )
        db.add(meas)
        db.commit()

        incidents = event_engine.evaluate_measurement(db, meas, device)
        assert len(incidents) >= 1
        heat_inc = next((i for i in incidents if i.event_type == "HIGH_TEMPERATURE"), None)
        assert heat_inc is not None
        assert heat_inc.status == "ACTIVE"
        assert heat_inc.triggering_value == 42.0

        # Recovery
        recovery_meas = Measurement(
            device_id=device.id,
            station_id=station.id,
            timestamp=datetime.now(timezone.utc),
            temperature_c=25.0,
            humidity_pct=50.0,
            pressure_hpa=1012.0,
            quality_flags='{"temp": "VALID"}',
            is_simulated=True
        )
        db.add(recovery_meas)
        db.commit()

        recovered_incidents = event_engine.evaluate_measurement(db, recovery_meas, device)
        resolved_inc = next((i for i in recovered_incidents if i.event_type == "HIGH_TEMPERATURE"), None)
        assert resolved_inc is not None
        assert resolved_inc.status == "RESOLVED"

    finally:
        db.close()

def test_csv_export_injection_protection():
    from backend.app.api.v1.reports import sanitize_csv_field
    assert sanitize_csv_field("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert sanitize_csv_field("+1+2") == "'+1+2"
    assert sanitize_csv_field("-123") == "'-123"
    assert sanitize_csv_field("@SUM(1,2)") == "'@SUM(1,2)"
    assert sanitize_csv_field("Normal Text") == "Normal Text"

def test_thingspeak_config_and_masking(client):
    r = client.get("/api/v1/thingspeak/config")
    assert r.status_code == 200
    data = r.json()
    assert "channel_id" in data
    assert "field_mapping" in data
    # Ensure keys are never exposed raw
    if data["read_api_key_masked"]:
        assert data["read_api_key_masked"].startswith("****")

def test_micromate_status_and_chat(client):
    r_status = client.get("/api/v1/micromate/status")
    assert r_status.status_code == 200
    st = r_status.json()
    assert st["name"] == "MicroMate"
    assert st["role"] == "Weather Monitoring Assistant"
    assert "emotion" in st
    assert "speech_cue" in st

    # Chat query for temperature
    r_chat = client.post("/api/v1/micromate/chat", json={
        "prompt": "What is the current temperature?",
        "language": "en"
    })
    assert r_chat.status_code == 200
    chat_data = r_chat.json()
    assert "temperature" in chat_data["response"].lower() or "°c" in chat_data["response"].lower()
    assert "emotion" in chat_data
    assert len(chat_data["suggestions"]) > 0

    # Chat query in Tamil
    r_ta = client.post("/api/v1/micromate/chat", json={
        "prompt": "வெப்பநிலை என்ன?",
        "language": "ta"
    })
    assert r_ta.status_code == 200
    assert "வெப்பநிலை" in r_ta.json()["response"]

    # Chat query in Hindi
    r_hi = client.post("/api/v1/micromate/chat", json={
        "prompt": "बारिश की क्या स्थिति है?",
        "language": "hi"
    })
    assert r_hi.status_code == 200
    assert "barish" in r_hi.json()["response"].lower() or "बारिश" in r_hi.json()["response"] or "mm" in r_hi.json()["response"]


from fastapi import APIRouter, HTTPException
from backend.app.services.simulator_service import simulator
from backend.app.schemas.schemas import (
    SimulatorStateResponse, SimulatorControlRequest, SimulatorScenarioRequest, SimulatorInjectRequest
)

router = APIRouter(prefix="/simulator", tags=["Simulator"])

@router.get("/state", response_model=SimulatorStateResponse)
async def get_simulator_state():
    return SimulatorStateResponse(**simulator.get_state())

@router.post("/control", response_model=SimulatorStateResponse)
async def control_simulator(req: SimulatorControlRequest):
    action = req.action.lower()
    if action == "start":
        simulator.start(speed=req.playback_speed)
    elif action == "pause":
        simulator.pause()
    elif action == "resume":
        simulator.resume()
    elif action == "stop":
        simulator.stop()
    elif action == "reset":
        simulator.reset()
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action '{req.action}'. Expected start, pause, resume, stop, reset.")

    if req.playback_speed and req.playback_speed > 0:
        simulator.playback_speed = req.playback_speed

    return SimulatorStateResponse(**simulator.get_state())

@router.post("/scenario", response_model=SimulatorStateResponse)
async def set_scenario(req: SimulatorScenarioRequest):
    valid_scenarios = [
        "normal_weather",
        "temperature_spike",
        "heavy_rain",
        "strong_wind",
        "rapid_pressure_drop",
        "sensor_disconnect",
        "wifi_outage",
        "battery_decline"
    ]
    if req.scenario not in valid_scenarios:
        raise HTTPException(status_code=400, detail=f"Scenario must be one of {valid_scenarios}")

    simulator.set_scenario(req.scenario)
    return SimulatorStateResponse(**simulator.get_state())

@router.post("/inject")
async def inject_anomaly(req: SimulatorInjectRequest):
    valid_metrics = ["temperature_c", "rain_rate_mmh", "wind_speed_mps", "pressure_hpa"]
    if req.metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Metric must be one of {valid_metrics}")

    steps = max(2, int((req.duration_seconds or 60) / 5))
    simulator.inject_anomaly(req.metric, req.value, steps)
    return {
        "status": "injected",
        "metric": req.metric,
        "value": req.value,
        "duration_steps": steps
    }

from pydantic import BaseModel
from typing import Optional

class DemoInjectPayload(BaseModel):
    metric: Optional[str] = None
    value: Optional[float] = None
    event_type: Optional[str] = "custom"

@router.post("/demo-inject")
async def inject_demo_event(req: Optional[DemoInjectPayload] = None):
    """
    Deterministic event injection endpoint with configurable sensor metric and value.
    Supports temperature, humidity, pressure, wind speed, and rain rate.
    """
    metric = req.metric if req else None
    val = req.value if req else None
    ev_type = req.event_type if req and req.event_type else "custom"

    result = await simulator.inject_demo_event(event_type=ev_type, metric=metric, value=val)
    return result


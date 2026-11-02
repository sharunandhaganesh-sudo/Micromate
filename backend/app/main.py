import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.db.init_db import init_db
from backend.app.services.simulator_service import simulator
from backend.app.services.mqtt_service import mqtt_service
from backend.app.services.thingspeak_service import thingspeak_service
from backend.app.services.websocket_manager import ws_manager

# API Routers
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.dashboard import router as dashboard_router
from backend.app.api.v1.stations import router as stations_router
from backend.app.api.v1.devices import router as devices_router
from backend.app.api.v1.telemetry import router as telemetry_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.events import router as events_router
from backend.app.api.v1.rules import router as rules_router
from backend.app.api.v1.notifications import router as notifications_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.simulator import router as simulator_router
from backend.app.api.v1.settings import router as settings_router
from backend.app.api.v1.thingspeak import router as thingspeak_router
from backend.app.api.v1.micromate import router as micromate_router
from backend.app.api.v1.health import router as health_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    init_db()

    try:
        loop = asyncio.get_running_loop()
        logger.info("Registering event loop with simulator service...")
        simulator.set_loop(loop)
        logger.info("Starting MQTT background client...")
        mqtt_service.start(loop)
        logger.info("Starting ThingSpeak background poller...")
        thingspeak_service.start(loop)
    except RuntimeError:
        logger.info("No running loop for background services in this thread.")

    if settings.ENABLE_DEMO_SIMULATOR_BY_DEFAULT:
        logger.info("Auto-starting weather simulator in background...")
        simulator.start(speed=1.0)

    yield

    # Shutdown
    logger.info("Stopping weather simulator...")
    simulator.stop()
    logger.info("Stopping MQTT client...")
    mqtt_service.stop()
    logger.info("Stopping ThingSpeak service...")
    thingspeak_service.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="IoT-Based Microclimate Monitoring and Extreme Weather Event Detection Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Health
app.include_router(health_router)

# Mount v1 API Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(dashboard_router, prefix=api_v1_prefix)
app.include_router(stations_router, prefix=api_v1_prefix)
app.include_router(devices_router, prefix=api_v1_prefix)
app.include_router(telemetry_router, prefix=api_v1_prefix)
app.include_router(analytics_router, prefix=api_v1_prefix)
app.include_router(events_router, prefix=api_v1_prefix)
app.include_router(rules_router, prefix=api_v1_prefix)
app.include_router(notifications_router, prefix=api_v1_prefix)
app.include_router(reports_router, prefix=api_v1_prefix)
app.include_router(simulator_router, prefix=api_v1_prefix)
app.include_router(settings_router, prefix=api_v1_prefix)
app.include_router(thingspeak_router, prefix=api_v1_prefix)
app.include_router(micromate_router, prefix=api_v1_prefix)

# WebSocket Realtime Telemetry Broadcast
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open, handle client heartbeats / ping
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

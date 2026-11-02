# AeroPulse + MicroMate: Microclimate Monitoring & Extreme Weather Intelligence Platform

A high-performance full-stack IoT environmental intelligence platform designed for microclimate monitoring, sensor verification, and experimental extreme weather anomaly detection. Supports **Option A: ThingSpeak Cloud as the primary cloud bridge** for ESP32 weather stations, alongside local MQTT / direct ingestion, featuring **MicroMate**—your friendly, intelligent weather robot companion.

---

## 🌟 Key Features

1. **Option A: ThingSpeak Cloud Primary Integration**:
   - Secure server-to-server REST polling & webhook sync from `api.thingspeak.com`.
   - Never exposes private channel API keys to browser clients (automatic key masking).
   - Ingestion into database with strict bounds validation, quality tagging, and anomaly detection.
   - Dedicated ThingSpeak configuration tab in **Settings** with interactive "Test Connection" and "Sync Now".
2. **MicroMate Weather Assistant Robot**:
   - Vector SVG character matching 8 emotional states (`happy`, `excited`, `thinking`, `worried`, `surprised`, `sleepy`, `sad`, `in_alert`).
   - Multilingual support: **English**, **தமிழ் (Tamil)**, and **हिन्दी (Hindi)**.
   - Browser speech synthesis with cheerful robot persona (`window.speechSynthesis`).
   - Natural language weather insights grounded in real verified readings (no hallucinations or fabrications).
   - Works fully out-of-the-box with deterministic rule engines even without external LLM keys, with optional Gemini/OpenAI enhancement.
3. **8 Core Navigation Workspaces**:
   - **Overview Command Center**: High-level station condition badge, real-time metrics with sparklines, multi-variable trend charts.
   - **Live Telemetry Stream**: Dedicated low-latency telemetry experience via WebSockets, online/stale/offline indicators, sensor gauges, live log.
   - **Weather Analytics**: Diurnal profiles, barometric drop detection, non-linear rainfall aggregation, and data completeness audits.
   - **Stations & Devices**: Full device lifecycle, token provisioning, MQTT topic ACLs, and per-sensor linear calibration formulas.
   - **Events & Alerts**: Real-time incident detection (heatwaves, squalls, rain bursts, sensor faults), forensic evidence chains, and one-click resolution.
   - **Historical Data Explorer**: Drill down into time-series records, zoom/filter, and export sanitized CSVs.
   - **Observational Reports**: Formal daily, weekly, and monthly weather summaries with printable layouts and CSV exports.
   - **Settings & Security**: Configurable detection rule thresholds, notification preferences, RBAC role validation, and audit logs.
2. **High-Fidelity Demo Simulator**:
   - 8 deterministic scenarios: Normal Weather, Temperature Spike, Heavy Rain, High Wind, Rapid Pressure Drop, Sensor Disconnect, Wi-Fi Outage, Battery Decline.
   - Interactive controls: Start, Pause, Resume, Stop, Reset, 1x-10x speed, and on-demand anomaly injection.
3. **Hardware Ready**:
   - Telemetry Contract v1 specification.
   - Complete C++ Arduino sketch for ESP32 + BME280 + Anemometer + Rain Gauge + SSD1306 OLED in `hardware/esp32_firmware/`.
   - Comprehensive wiring and deployment guide in `hardware/ESP32_INTEGRATION_GUIDE.md`.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, TanStack Query, React Hook Form, Zod.
- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy, Paho MQTT, Bcrypt, PyJWT.
- **Database**: SQLite (default local zero-friction) or PostgreSQL / TimescaleDB (production).
- **Messaging**: Eclipse Mosquitto MQTT broker with topic-based ACLs.
- **Deployment**: Docker & Docker Compose.

---

## 🚀 Quickstart: Local Development

### 1. Backend Setup

```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run database migrations and seed baseline data
python -m backend.app.db.init_db

# Start FastAPI backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be accessible at:
- API Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health/live`
- Realtime WebSocket: `ws://localhost:8000/ws/telemetry`

Default Seed Accounts:
- **Admin**: `admin` / `AdminPassword2026!`
- **Operator**: `operator` / `OperatorPassword2026!`
- **Viewer**: `viewer` / `ViewerPassword2026!`

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Frontend will open at: `http://localhost:5173`

---

## 🧪 Running Automated Tests

Run the backend integration test suite:

```bash
pytest backend/tests/test_backend.py -v
```

All 9 test suites verify:
- Health and liveness endpoints.
- Role-based login and authentication token generation.
- Dashboard summary aggregations and freshness tracking.
- Strict Telemetry Contract v1 validation and bound rejection.
- Idempotent duplicate message rejection.
- Simulator state transitions, playback speeds, and scenario changes.
- Event Detection Engine threshold triggers and hysteresis recovery.
- CSV export formula injection sanitization.

---

## 🐳 Production Deployment with Docker Compose

To run the complete production stack (TimescaleDB, Mosquitto MQTT, FastAPI backend, and Nginx React frontend):

```bash
docker compose up -d --build
```

Access the production frontend at `http://localhost` (port 80).

---

## 📡 Connecting a Physical ESP32 Weather Station

1. Review the wiring diagram and BOM in `hardware/ESP32_INTEGRATION_GUIDE.md`.
2. Register your station and device in the web app under **Stations & Devices** to generate a device token.
3. Open `hardware/esp32_firmware/esp32_weather_station.ino` in Arduino IDE.
4. Set `WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_BROKER`, and `DEVICE_ID`.
5. Flash to the ESP32. Real telemetry will instantly stream to the **Live Monitoring** dashboard!

# Microclimate Deployment Guide

This guide describes how to deploy **Microclimate** (IoT Microclimate Monitoring & Extreme Weather Detection with **MicroMate** and **Ridgecrest Observatory**) to production environments.

---

## 1. System Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS SPA, deployed on **Vercel** or any static web host.
- **Backend**: FastAPI ASGI Python 3.11+ application, deployed on **Render**, **Railway**, **Fly.io**, or Docker.
- **Hardware / Telemetry**: ESP32 + BME280 transmitting sensor telemetry to **ThingSpeak Cloud** (Option A) or low-latency HTTP/MQTT.
- **Assistant**: **MicroMate** real-time environmental assistant providing status, advice, and actionable warnings.

---

## 2. Frontend Deployment (Vercel)

1. **Connect Repository**:
   - Push code to GitHub/GitLab.
   - Import project into Vercel dashboard.

2. **Root Directory**:
   - Set Root Directory to `frontend`.

3. **Build & Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables**:
   - Add `VITE_API_BASE_URL`: Set to your deployed FastAPI backend URL with `/api/v1` prefix (e.g., `https://api.yourdomain.com/api/v1`).

5. **SPA Rewrites**:
   - The included `frontend/vercel.json` automatically handles client-side routing so routes like `/live`, `/events`, and `/settings` reload seamlessly.

---

## 3. Backend Deployment (Render / Railway / Docker)

### Option A: Render or Railway

1. **Build Command**:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Start Command**:
   ```bash
   python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
   ```

3. **Environment Variables**:
   Copy variables from `.env.production.example`:
   - `SECRET_KEY`: Set to a strong random token.
   - `CORS_ORIGINS`: Comma-separated list of allowed frontend origins (e.g., `https://your-app.vercel.app`).
   - `DATABASE_URL`: Production PostgreSQL URL (or SQLite for light loads).
   - `THINGSPEAK_CHANNEL_ID`: Your ThingSpeak channel ID.
   - `THINGSPEAK_READ_API_KEY`: Your ThingSpeak Read API Key.

### Option B: Docker Container

Build and run using Docker:

```bash
docker build -t microclimate-backend -f Dockerfile .
docker run -d -p 8000:8000 --env-file .env.production.example microclimate-backend
```

---

## 4. Production Checklist

- [x] Streamlined navigation to 4 primary sections: `Overview`, `Live Monitoring`, `Alerts`, and `Settings`.
- [x] Realistic 3D visualizations active for Temperature, Humidity, Barometer, Wind, and Rain.
- [x] Single-click deterministic demonstration action: **"Inject Event"** (Heavy Rain Alert > 30 mm/h).
- [x] MicroMate active alert pop-up banner reacting to new incidents with actionable safety advice.
- [x] ThingSpeak Cloud API integration with backend credential masking.
- [x] High-contrast typography and clear button text labels throughout.

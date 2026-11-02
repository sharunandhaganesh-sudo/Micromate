# ESP32 Microclimate & Weather Station Integration Guide

This guide details how to connect, provision, and deploy a physical **ESP32 weather station** to the AeroPulse platform.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Part / Model | Interface | Function |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32D (or NodeMCU-32S) | Wi-Fi / BLE | Core compute, MQTT TLS, interrupts |
| **Atmospheric Sensor** | Bosch BME280 | I2C (0x76 or 0x77) | Temperature, relative humidity, pressure |
| **Wind Speed** | 3-Cup Anemometer (Reed switch pulse) | GPIO 14 (Interrupt) | Wind velocity (m/s) |
| **Rainfall Gauge** | Tipping-Bucket Rain Gauge (Reed switch) | GPIO 27 (Interrupt) | Precipitation depth (0.2794 mm/tip) |
| **Local Display** | 0.96" OLED (SSD1306) | I2C (0x3C) | Field status, sensor values, Wi-Fi RSSI |
| **Power Supply** | 3.7V 18650 Li-ion battery + Solar TP4056 | ADC GPIO 35 (2:1 divider) | Remote solar/battery autonomous operation |

---

## 2. Wiring & Pinout Schematic

### I2C Bus (Shared between BME280 & SSD1306 OLED)
- **ESP32 GPIO 21** ➔ **SDA** (BME280 & OLED)
- **ESP32 GPIO 22** ➔ **SCL** (BME280 & OLED)
- **ESP32 3V3** ➔ **VCC** (BME280 & OLED)
- **ESP32 GND** ➔ **GND** (BME280 & OLED)

### Pulse Sensor Inputs (Anemometer & Rain Gauge)
- **Anemometer Signal Pin 1** ➔ **ESP32 GPIO 14** (configured with `INPUT_PULLUP`)
- **Anemometer Signal Pin 2** ➔ **ESP32 GND**
- **Rain Gauge Signal Pin 1** ➔ **ESP32 GPIO 27** (configured with `INPUT_PULLUP`)
- **Rain Gauge Signal Pin 2** ➔ **ESP32 GND**

### Battery Voltage Monitor
- Connect battery `(+)` to a 100kΩ resistor, then to **GPIO 35**, then a 100kΩ resistor to **GND**.
- Attenuation factor: 2:1 (allows measuring up to 4.2V within the ESP32 3.3V ADC range).

---

## 3. Device Registration & Credential Provisioning

1. In the AeroPulse web application, navigate to **Stations & Devices** or click **"+ Add Station"**.
2. Click **"Register New Device Node"**.
3. Choose a unique Device Identifier (e.g. `node01` or `esp32-alpha-01`).
4. Copy the provisioned MQTT topics and HTTP access token:
   - **Telemetry Topic**: `microclimate/v1/devices/{device_id}/telemetry`
   - **Status LWT Topic**: `microclimate/v1/devices/{device_id}/status`
   - **MQTT Username**: `mqtt_{device_id}`

---

## 4. Telemetry Contract v1 Specification

All devices publish JSON payloads matching this contract to `microclimate/v1/devices/{device_id}/telemetry`:

```json
{
  "schema_version": 1,
  "message_id": "node01-1042",
  "device_id": "node01",
  "boot_id": "d1c0b34e-4f1a-4d43-98fe-bc5e683416e8",
  "sequence": 1042,
  "timestamp": "2026-11-02T12:00:00Z",
  "uptime_seconds": 3600,
  "firmware_version": "1.0.0-prod",
  "measurements": {
    "temperature_c": 24.5,
    "humidity_pct": 58.0,
    "pressure_hpa": 1012.4,
    "wind_speed_mps": 4.2,
    "wind_gust_mps": 6.1,
    "rainfall_interval_mm": 0.0,
    "rainfall_total_mm": 14.8,
    "rain_rate_mmh": 0.0
  },
  "health": {
    "battery_voltage_v": 4.08,
    "battery_percent": 88.0,
    "wifi_rssi_dbm": -58
  }
}
```

### Ingestion Validation Rules:
- **Temperature**: -50.0 to 80.0 °C
- **Humidity**: 0.0 to 100.0 %
- **Pressure**: 800.0 to 1200.0 hPa
- **Wind Speed**: Canonical unit is meters per second (**m/s**). Frontend automatically displays km/h conversions.
- **Rainfall Total**: Cumulative gauge depth in mm. Rollovers and sequence resets are detected automatically without false jumps.

---

## 5. Firmware Installation (Arduino IDE or PlatformIO)

1. Open `hardware/esp32_firmware/esp32_weather_station.ino`.
2. Install the required libraries in Arduino Library Manager:
   - `Adafruit BME280 Library`
   - `Adafruit SSD1306`
   - `PubSubClient`
   - `ArduinoJson` (v6 or v7)
3. Update your credentials at the top of the file:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* MQTT_BROKER   = "YOUR_SERVER_IP";
   const char* DEVICE_ID     = "node01";
   ```
4. Select board **"ESP32 Dev Module"**, connect via USB, and click **Upload**.
5. Open Serial Monitor at **115200 baud** to verify Wi-Fi association, NTP synchronization, and MQTT telemetry publishing.

---

## 6. End-to-End Verification Checklist

- [x] OLED displays real-time local temperature, humidity, pressure, and wind speed.
- [x] Serial monitor logs `[Telemetry] Seq X | Pub: OK`.
- [x] AeroPulse **Live Monitoring** page switches to **"LIVE"** (green badge).
- [x] Trigger rain gauge bucket tip manually; verify **Cumulative Rainfall** increases by 0.28 mm.
- [x] Spin anemometer; verify wind speed reflects pulses on the dashboard.
- [x] Disconnect Wi-Fi; verify device transitions from **ONLINE** ➔ **STALE** (after 120s) ➔ **OFFLINE** (after 300s).


---

## 7. Option A: ThingSpeak Cloud Integration (Primary Direct Ingestion)

The platform supports **ThingSpeak as the primary cloud bridge** for ESP32 weather stations. This requires zero firewall port forwarding or local MQTT brokers.

### Step 1: Create or Configure your ThingSpeak Channel
1. Sign in to [ThingSpeak.com](https://thingspeak.com).
2. Create a new Channel (e.g., `ESP32 Weather Intelligence`).
3. Set the Field names as follows:
   - **Field 1**: `temperature` (°C)
   - **Field 2**: `humidity` (%)
   - **Field 3**: `pressure` (hPa)
   - **Field 4**: `wind_speed` (km/h)
   - **Field 5**: `rainfall` (accumulated mm)
   - **Field 6**: `battery_voltage` (V)
   - **Field 7**: `rain_rate` (mm/h)
   - **Field 8**: `wind_pulses`
4. Copy your **Channel ID** and **Write API Key** from the *API Keys* tab.
5. If the channel is private, copy the **Read API Key**.

### Step 2: Flash the ThingSpeak ESP32 Sketch
1. Open [`hardware/esp32_firmware/esp32_thingspeak_weather_station.ino`](file:///hardware/esp32_firmware/esp32_thingspeak_weather_station.ino) in Arduino IDE or VS Code PlatformIO.
2. Update `WIFI_SSID` and `WIFI_PASSWORD`.
3. Set `THINGSPEAK_CHANNEL_ID` and `THINGSPEAK_WRITE_API_KEY`.
4. Compile and upload to your ESP32 board.
5. Open Serial Monitor (115200 baud) to verify telemetry transmission (`[ThingSpeak OK] New Entry ID #...`).

### Step 3: Link ThingSpeak in AeroPulse Settings
1. In AeroPulse dashboard, navigate to **Settings** -> **ThingSpeak Cloud**.
2. Enter your **Channel ID** and **Read API Key**.
3. Set your preferred polling interval (default: 30s).
4. Click **"Test Connection"** to verify handshake and live channel statistics.
5. Click **"Sync Now"** to pull the latest real sensor feeds immediately.
6. Check with **MicroMate**! You can ask MicroMate: *"How is the ThingSpeak connection?"* or *"What's the current temperature?"* and it will respond with verified live readings.

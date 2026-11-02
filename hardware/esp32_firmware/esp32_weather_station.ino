/*
 * AeroPulse ESP32 Microclimate & Extreme Weather Station Firmware
 * 
 * Hardware Configuration:
 * - ESP32 Development Board (ESP-WROOM-32)
 * - Bosch BME280 (I2C: SDA=GPIO21, SCL=GPIO22, Addr=0x76): Temperature, Humidity, Pressure
 * - Cup Anemometer: Reed Switch Pulse Input on GPIO 14 (Internal Pullup, Interrupt)
 * - Tipping Bucket Rain Gauge: Reed Switch on GPIO 27 (Internal Pullup, Interrupt)
 * - 0.96" I2C OLED (SSD1306, Addr=0x3C, Shared I2C Bus)
 * - Battery Monitor: Voltage divider (100k / 100k) on ADC GPIO 35
 * 
 * Libraries Required (Arduino Library Manager):
 * - Adafruit BME280 Library
 * - Adafruit SSD1306 & Adafruit GFX Library
 * - PubSubClient (by Nick O'Leary)
 * - ArduinoJson (v6 or v7 by Benoit Blanchon)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <time.h>

// ==================== CONFIGURATION ====================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER   = "192.168.1.100"; // Or your public domain / host
const int   MQTT_PORT     = 1883;            // 1883 for TCP, 8883 for TLS
const char* MQTT_USER     = "mqtt_node01";
const char* MQTT_PASSWORD = "YOUR_DEVICE_MQTT_PASSWORD";

const char* DEVICE_ID     = "node01";        // Must match backend registered device_identifier
const char* FIRMWARE_VER  = "1.0.0-prod";

// MQTT Topics
const char* TOPIC_TELEMETRY = "microclimate/v1/devices/node01/telemetry";
const char* TOPIC_STATUS    = "microclimate/v1/devices/node01/status";

// NTP Server
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 0; // UTC
const int   DAYLIGHT_OFFSET_SEC = 0;

// Hardware Pins
#define PIN_ANEMOMETER 14
#define PIN_RAIN_GAUGE 27
#define PIN_BATTERY_ADC 35
#define I2C_SDA 21
#define I2C_SCL 22

// Screen dimensions
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_BME280 bme;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Calibration Constants
const float RAIN_MM_PER_TIP = 0.2794;     // Standard 0.011 inch bucket
const float ANEMOMETER_FACTOR = 0.667;     // 1 pulse/sec = 0.667 m/s (2.4 km/h)

// Global State
volatile unsigned long windPulseCount = 0;
volatile unsigned long rainTipCount = 0;
volatile unsigned long lastWindPulseTime = 0;
volatile unsigned long lastRainTipTime = 0;

unsigned long sequenceCounter = 0;
char bootSessionId[37];
unsigned long lastSampleMillis = 0;
const unsigned long SAMPLE_INTERVAL_MS = 10000; // 10 seconds

float cumulativeRainfallMm = 0.0;

// ==================== INTERRUPT HANDLERS ====================
void IRAM_ATTR isrWindPulse() {
  unsigned long now = millis();
  if (now - lastWindPulseTime > 15) { // 15ms debounce
    windPulseCount++;
    lastWindPulseTime = now;
  }
}

void IRAM_ATTR isrRainTip() {
  unsigned long now = millis();
  if (now - lastRainTipTime > 200) { // 200ms debounce
    rainTipCount++;
    lastRainTipTime = now;
  }
}

// Generate random UUID for boot session
void generateBootId() {
  uint32_t r1 = esp_random();
  uint32_t r2 = esp_random();
  snprintf(bootSessionId, sizeof(bootSessionId), "%08x-%04x-%04x-%04x-%08x%04x",
           r1, (uint16_t)(r2 >> 16), (uint16_t)r2, (uint16_t)(r1 >> 16), r2, (uint16_t)r1);
}

// Format ISO 8601 UTC timestamp string
void getIsoTimestamp(char* buffer, size_t maxLen) {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    snprintf(buffer, maxLen, "1970-01-01T00:00:00Z");
    return;
  }
  strftime(buffer, maxLen, "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
}

// Read Li-ion battery voltage via 2:1 resistive divider
float readBatteryVoltage() {
  int raw = analogRead(PIN_BATTERY_ADC);
  // ESP32 ADC: 3.3V reference, 12-bit (4095), 2:1 divider factor = 2.0
  float voltage = (raw / 4095.0) * 3.3 * 2.0 * 1.05; // 1.05 hardware trim
  return voltage;
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[AeroPulse] Initializing Weather Station Node...");

  generateBootId();
  Serial.printf("[AeroPulse] Boot Session ID: %s\n", bootSessionId);

  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("[Warning] SSD1306 OLED not found on 0x3C");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("AeroPulse Node");
    display.println("Booting station...");
    display.display();
  }

  // Initialize BME280
  if (!bme.begin(0x76, &Wire)) {
    Serial.println("[Error] BME280 not found! Check wiring at I2C 0x76.");
  } else {
    Serial.println("[AeroPulse] BME280 initialized successfully.");
  }

  // Configure Interrupt Pins
  pinMode(PIN_ANEMOMETER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ANEMOMETER), isrWindPulse, FALLING);

  pinMode(PIN_RAIN_GAUGE, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_RAIN_GAUGE), isrRainTip, FALLING);

  pinMode(PIN_BATTERY_ADC, INPUT);

  // Connect to Wi-Fi
  connectWiFi();

  // Configure NTP
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);

  // Configure MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(1024);
}

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s, RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Connection failed. Retrying in background.");
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    Serial.print("[MQTT] Attempting broker connection...");
    if (mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD, TOPIC_STATUS, 1, true, "{\"status\":\"OFFLINE\"}")) {
      Serial.println(" Connected!");
      // Publish retained ONLINE status
      mqttClient.publish(TOPIC_STATUS, "{\"status\":\"ONLINE\"}", true);
    } else {
      Serial.printf(" Failed, rc=%d. Retrying in 5 seconds...\n", mqttClient.state());
      delay(5000);
    }
  }
}

// ==================== MAIN LOOP ====================
void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - lastSampleMillis >= SAMPLE_INTERVAL_MS) {
    float intervalSec = (currentMillis - lastSampleMillis) / 1000.0;
    lastSampleMillis = currentMillis;

    // 1. Process Wind Speed
    noInterrupts();
    unsigned long pulses = windPulseCount;
    windPulseCount = 0;
    interrupts();

    float windSpeedMps = (pulses / intervalSec) * ANEMOMETER_FACTOR;
    float windGustMps = windSpeedMps * 1.35; // Peak estimate

    // 2. Process Rain Gauge
    noInterrupts();
    unsigned long tips = rainTipCount;
    rainTipCount = 0;
    interrupts();

    float intervalRainMm = tips * RAIN_MM_PER_TIP;
    cumulativeRainfallMm += intervalRainMm;
    float rainRateMmh = (intervalRainMm / (intervalSec / 3600.0));

    // 3. Read BME280
    float tempC = bme.readTemperature();
    float humPct = bme.readHumidity();
    float pressHpa = bme.readPressure() / 100.0F;

    // 4. Battery & Signal
    float battV = readBatteryVoltage();
    float battPct = constrain((battV - 3.2) / (4.2 - 3.2) * 100.0, 0.0, 100.0);
    int wifiRssi = WiFi.RSSI();

    // 5. Construct Telemetry Contract v1 JSON
    StaticJsonDocument<768> doc;
    doc["schema_version"] = 1;

    char msgId[40];
    snprintf(msgId, sizeof(msgId), "%s-%lu", DEVICE_ID, sequenceCounter);
    doc["message_id"] = msgId;
    doc["device_id"] = DEVICE_ID;
    doc["boot_id"] = bootSessionId;
    doc["sequence"] = sequenceCounter++;

    char isoTime[30];
    getIsoTimestamp(isoTime, sizeof(isoTime));
    doc["timestamp"] = isoTime;
    doc["uptime_seconds"] = currentMillis / 1000;
    doc["firmware_version"] = FIRMWARE_VER;

    JsonObject m = doc.createNestedObject("measurements");
    if (!isnan(tempC)) m["temperature_c"] = round(tempC * 10.0) / 10.0;
    if (!isnan(humPct)) m["humidity_pct"] = round(humPct * 10.0) / 10.0;
    if (!isnan(pressHpa)) m["pressure_hpa"] = round(pressHpa * 10.0) / 10.0;
    m["wind_speed_mps"] = round(windSpeedMps * 10.0) / 10.0;
    m["wind_gust_mps"] = round(windGustMps * 10.0) / 10.0;
    m["rainfall_interval_mm"] = round(intervalRainMm * 100.0) / 100.0;
    m["rainfall_total_mm"] = round(cumulativeRainfallMm * 10.0) / 10.0;
    m["rain_rate_mmh"] = round(rainRateMmh * 10.0) / 10.0;

    JsonObject h = doc.createNestedObject("health");
    h["battery_voltage_v"] = round(battV * 100.0) / 100.0;
    h["battery_percent"] = round(battPct);
    h["wifi_rssi_dbm"] = wifiRssi;

    char jsonBuffer[768];
    serializeJson(doc, jsonBuffer);

    // 6. Publish via MQTT QoS 1
    bool pubSuccess = mqttClient.publish(TOPIC_TELEMETRY, jsonBuffer, false);
    Serial.printf("[Telemetry] Seq %lu | Temp: %.1fC | Hum: %.1f%% | Press: %.1fhPa | Rain: %.2fmm | Pub: %s\n",
                  sequenceCounter - 1, tempC, humPct, pressHpa, cumulativeRainfallMm, pubSuccess ? "OK" : "ERR");

    // 7. Update Onboard OLED Display
    display.clearDisplay();
    display.setCursor(0, 0);
    display.printf("T: %.1fC   H: %.0f%%\n", tempC, humPct);
    display.printf("P: %.1f hPa\n", pressHpa);
    display.printf("Wind: %.1f m/s\n", windSpeedMps);
    display.printf("Rain: %.1f mm\n", cumulativeRainfallMm);
    display.printf("WiFi: %d dBm %s\n", wifiRssi, pubSuccess ? "[MQTT]" : "[ERR]");
    display.display();
  }
}

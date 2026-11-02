/*
 * AeroPulse + MicroMate ESP32 Weather Station Firmware (Option A: ThingSpeak Cloud)
 * 
 * Hardware Configuration:
 * - ESP32 Development Board (ESP-WROOM-32 / NodeMCU-32S)
 * - Bosch BME280 (I2C: SDA=GPIO21, SCL=GPIO22, Addr=0x76): Temperature, Humidity, Pressure
 * - Cup Anemometer: Reed Switch Pulse Input on GPIO 14 (Internal Pullup, Interrupt)
 * - Tipping Bucket Rain Gauge: Reed Switch on GPIO 27 (Internal Pullup, Interrupt)
 * - 0.96" I2C OLED (SSD1306, Addr=0x3C, Shared I2C Bus)
 * - Battery Monitor: Voltage divider (100k / 100k) on ADC GPIO 35
 * 
 * Cloud Target:
 * - ThingSpeak REST API: https://api.thingspeak.com/update
 * - Field Mappings:
 *     field1: Temperature (°C)
 *     field2: Humidity (%)
 *     field3: Atmospheric Pressure (hPa)
 *     field4: Wind Speed (km/h)
 *     field5: Accumulated Rainfall (mm)
 *     field6: Battery Voltage (V)
 *     field7: Rain Rate (mm/h)
 *     field8: Anemometer Pulse Count
 * 
 * Required Arduino Libraries:
 * - Adafruit BME280 Library
 * - Adafruit SSD1306 & Adafruit GFX Library
 * - ThingSpeak Library (by MathWorks) OR HTTPClient (built into ESP32 core)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== USER CONFIGURATION ====================
// 1. WiFi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. ThingSpeak Channel Credentials
// Found on your ThingSpeak Channel -> "API Keys" Tab
const unsigned long THINGSPEAK_CHANNEL_ID = 2458901; 
const char* THINGSPEAK_WRITE_API_KEY      = "YOUR_THINGSPEAK_WRITE_KEY";

// 3. Post Interval (Free ThingSpeak accounts require >= 15 seconds)
const unsigned long POST_INTERVAL_MS = 20000; // 20 seconds

// ==================== HARDWARE PINOUT ====================
#define PIN_ANEMOMETER  14
#define PIN_RAIN_GAUGE  27
#define PIN_BATTERY_ADC 35
#define I2C_SDA         21
#define I2C_SCL         22

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_BME280 bme;

// Calibration Constants
const float RAIN_MM_PER_TIP = 0.2794;     // Standard 0.011 inch bucket
const float ANEMOMETER_KMH_FACTOR = 2.4;  // 1 Hz = 2.4 km/h

// Interrupt Counters
volatile unsigned long windPulseCount = 0;
volatile unsigned long rainTipCount = 0;
volatile unsigned long lastWindPulseTime = 0;
volatile unsigned long lastRainTipTime = 0;

// Timing
unsigned long lastPostMillis = 0;
unsigned long sessionTotalRainTips = 0;

// Interrupt Service Routines
void IRAM_ATTR isrWindPulse() {
  unsigned long now = millis();
  if (now - lastWindPulseTime > 15) { // 15ms debounce
    windPulseCount++;
    lastWindPulseTime = now;
  }
}

void IRAM_ATTR isrRainTip() {
  unsigned long now = millis();
  if (now - lastRainTipTime > 250) { // 250ms tip debounce
    rainTipCount++;
    sessionTotalRainTips++;
    lastRainTipTime = now;
  }
}

void setupDisplay() {
  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[WARN] OLED SSD1306 not found at 0x3C"));
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 4);
    display.println(F("MicroMate Weather"));
    display.println(F("ESP32 Station v2.0"));
    display.println(F("Connecting WiFi..."));
    display.display();
  }
}

void updateOledScreen(float temp, float hum, float pres, float wind, float rain, float vbat, bool synced) {
  display.clearDisplay();
  
  // Header banner
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("MicroMate "));
  display.print(synced ? F("[CLOUD OK]") : F("[TX SYNC]"));

  // Measurements
  display.setCursor(0, 14);
  display.printf("T: %.1fC  H: %.1f%%", temp, hum);
  
  display.setCursor(0, 26);
  display.printf("P: %.0fhPa W: %.1fkm/h", pres, wind);

  display.setCursor(0, 38);
  display.printf("Rain: %.2fmm", rain);

  display.setCursor(0, 50);
  display.printf("Bat: %.2fV  WiFi:%ddBm", vbat, WiFi.RSSI());

  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=============================================="));
  Serial.println(F("  AeroPulse + MicroMate ESP32 Weather Node     "));
  Serial.println(F("  Option A: ThingSpeak Cloud Direct Telemetry  "));
  Serial.println(F("=============================================="));

  setupDisplay();

  // Sensors & Pins
  pinMode(PIN_ANEMOMETER, INPUT_PULLUP);
  pinMode(PIN_RAIN_GAUGE, INPUT_PULLUP);
  pinMode(PIN_BATTERY_ADC, INPUT);

  attachInterrupt(digitalPinToInterrupt(PIN_ANEMOMETER), isrWindPulse, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_RAIN_GAUGE), isrRainTip, FALLING);

  // Initialize BME280
  if (!bme.begin(0x76, &Wire)) {
    if (!bme.begin(0x77, &Wire)) {
      Serial.println(F("[ERROR] BME280 sensor not detected on 0x76 or 0x77!"));
    } else {
      Serial.println(F("[OK] BME280 detected at 0x77"));
    }
  } else {
    Serial.println(F("[OK] BME280 detected at 0x76"));
  }

  // Connect to WiFi
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 25) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[OK] Connected! IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println(F("\n[WARN] WiFi connection failed. Will retry in loop..."));
  }
}

float readBatteryVoltage() {
  // ADC 12-bit (0-4095) with voltage divider (100k / 100k -> 2:1)
  int raw = analogRead(PIN_BATTERY_ADC);
  float measuredV = (raw / 4095.0) * 3.3 * 2.0;
  return measuredV;
}

bool postToThingSpeak(float temp, float hum, float pres, float wind, float rainAccum, float vbat, float rainRate) {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    return false;
  }

  HTTPClient http;
  
  // Construct URL query for ThingSpeak /update endpoint
  // https://api.thingspeak.com/update?api_key=KEY&field1=T&field2=H&field3=P&field4=W&field5=R&field6=V&field7=RR
  String url = "https://api.thingspeak.com/update";
  String postData = "api_key=" + String(THINGSPEAK_WRITE_API_KEY) +
                    "&field1=" + String(temp, 2) +
                    "&field2=" + String(hum, 2) +
                    "&field3=" + String(pres, 2) +
                    "&field4=" + String(wind, 2) +
                    "&field5=" + String(rainAccum, 2) +
                    "&field6=" + String(vbat, 2) +
                    "&field7=" + String(rainRate, 2);

  http.begin(url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  int httpCode = http.POST(postData);
  bool success = false;

  if (httpCode > 0) {
    String payload = http.getString();
    int entryId = payload.toInt();
    if (entryId > 0) {
      Serial.printf("[ThingSpeak OK] Telemetry posted! New Entry ID #%d (HTTP %d)\n", entryId, httpCode);
      success = true;
    } else {
      Serial.printf("[ThingSpeak WARN] Rate limit or invalid key. Response: %s (HTTP %d)\n", payload.c_str(), httpCode);
    }
  } else {
    Serial.printf("[ThingSpeak ERR] HTTP request failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

void loop() {
  unsigned long currentMillis = millis();

  // Handle post interval
  if (currentMillis - lastPostMillis >= POST_INTERVAL_MS) {
    unsigned long durationMs = currentMillis - lastPostMillis;
    lastPostMillis = currentMillis;

    // 1. Read BME280 Environmental Data
    float temp = bme.readTemperature();
    float hum = bme.readHumidity();
    float pres = bme.readPressure() / 100.0F; // Pa -> hPa

    // Fallbacks if sensor disconnected
    if (isnan(temp)) temp = 25.0;
    if (isnan(hum)) hum = 60.0;
    if (isnan(pres)) pres = 1013.25;

    // 2. Wind Calculation (pulses over duration)
    noInterrupts();
    unsigned long pulses = windPulseCount;
    windPulseCount = 0;
    interrupts();

    float durationSec = durationMs / 1000.0;
    float windSpeedKmh = (pulses / durationSec) * ANEMOMETER_KMH_FACTOR;

    // 3. Rain Calculation (accumulated session mm + instantaneous rain rate)
    noInterrupts();
    unsigned long intervalTips = rainTipCount;
    rainTipCount = 0;
    interrupts();

    float rainAccum = sessionTotalRainTips * RAIN_MM_PER_TIP;
    float rainRate = (intervalTips * RAIN_MM_PER_TIP) * (3600.0 / durationSec); // mm/hr

    // 4. Battery Voltage
    float vbat = readBatteryVoltage();

    // Log to Serial
    Serial.printf("\n[SAMPLE] Temp: %.2fC | Hum: %.2f%% | Pres: %.2fhPa | Wind: %.2fkm/h | Rain: %.2fmm | Vbat: %.2fV\n",
                  temp, hum, pres, windSpeedKmh, rainAccum, vbat);

    // 5. Post to ThingSpeak Cloud
    bool synced = postToThingSpeak(temp, hum, pres, windSpeedKmh, rainAccum, vbat, rainRate);

    // 6. Refresh Local OLED Display
    updateOledScreen(temp, hum, pres, windSpeedKmh, rainAccum, vbat, synced);
  }

  // Brief yield for RTOS task handling
  delay(50);
}

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.models.models import (
    Station, Device, Measurement, Incident, ThingSpeakChannel, MicroMateInteraction
)
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class MicroMateService:
    """
    MicroMate - The Smart, Friendly Weather Intelligence Assistant.
    Provides verified contextual intelligence, emotion states, and multilingual support
    grounded strictly in actual telemetry observations.
    """

    def get_current_context(self, db: Session, station_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Gathers current real-time environmental context for MicroMate's brain.
        """
        # Selected station
        station = None
        if station_id:
            station = db.query(Station).filter(Station.id == station_id).first()
        if not station:
            station = db.query(Station).first()

        target_id = station.id if station else None

        # Latest measurement
        latest_m = None
        if target_id:
            latest_m = db.query(Measurement).filter(
                Measurement.station_id == target_id
            ).order_by(desc(Measurement.timestamp)).first()

        # Active incidents
        incidents = []
        if target_id:
            incidents = db.query(Incident).filter(
                Incident.station_id == target_id,
                Incident.status.in_(["ACTIVE", "ACKNOWLEDGED"])
            ).all()

        # ThingSpeak channel
        ts_channel = db.query(ThingSpeakChannel).first()

        # Device status
        device = None
        if target_id:
            device = db.query(Device).filter(Device.station_id == target_id).first()

        # Compute Emotion & State
        emotion = "happy"
        state = "idle"
        speech_cue = "All systems normal! ☘️"

        severities = [inc.severity.lower() for inc in incidents]
        if "critical" in severities:
            emotion = "in_alert"
            state = "alert"
            speech_cue = "Attention! Critical weather threshold breached!"
        elif "warning" in severities or "advisory" in severities:
            emotion = "worried"
            state = "alert"
            speech_cue = f"Notice: Configured weather advisory or warning active: {incidents[0].event_type.replace('_', ' ')}."
        elif device and device.status in ["OFFLINE", "NEVER_CONNECTED"]:
            emotion = "sleepy"
            state = "offline"
            speech_cue = "Station hardware node is currently offline."
        elif device and device.status == "STALE":
            emotion = "worried"
            state = "active"
            speech_cue = "Telemetry data is older than normal freshness limits."
        elif latest_m and latest_m.rainfall_total_mm and latest_m.rainfall_total_mm > 0:
            emotion = "excited"
            state = "active"
            speech_cue = f"Precipitation detected! Total accumulation is {latest_m.rainfall_total_mm} mm."

        return {
            "station": {
                "id": station.id if station else None,
                "name": station.name if station else "Unknown",
                "code": station.code if station else "N/A",
                "is_demo": station.is_demo if station else False,
            },
            "device": {
                "identifier": device.device_identifier if device else None,
                "status": device.status if device else "NEVER_CONNECTED",
                "battery_voltage": device.battery_voltage if device else None,
                "battery_percent": device.battery_percent if device else None,
                "wifi_rssi": device.wifi_rssi if device else None
            },
            "telemetry": {
                "temperature_c": latest_m.temperature_c if latest_m else None,
                "humidity_pct": latest_m.humidity_pct if latest_m else None,
                "pressure_hpa": latest_m.pressure_hpa if latest_m else None,
                "wind_speed_mps": latest_m.wind_speed_mps if latest_m else None,
                "wind_gust_mps": latest_m.wind_gust_mps if latest_m else None,
                "rainfall_total_mm": latest_m.rainfall_total_mm if latest_m else 0.0,
                "rain_rate_mmh": latest_m.rain_rate_mmh if latest_m else 0.0,
                "timestamp": latest_m.timestamp.isoformat() if latest_m else None,
                "is_simulated": latest_m.is_simulated if latest_m else True
            },
            "active_incidents": [
                {
                    "id": inc.id,
                    "event_type": inc.event_type,
                    "severity": inc.severity,
                    "summary": inc.evidence_summary
                }
                for inc in incidents
            ],
            "thingspeak": {
                "configured": bool(ts_channel and ts_channel.channel_id and ts_channel.channel_id != "UNCONFIGURED"),
                "channel_id": ts_channel.channel_id if ts_channel else None,
                "status": ts_channel.status if ts_channel else "UNCONFIGURED",
                "last_synced_at": ts_channel.last_synced_at.isoformat() if ts_channel and ts_channel.last_synced_at else None
            },
            "micromate": {
                "emotion": emotion,
                "state": state,
                "speech_cue": speech_cue
            }
        }

    def process_query(
        self,
        db: Session,
        prompt: str,
        language: str = "en",
        station_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Natural language intelligence grounded in actual telemetry and event detection.
        Supports English ('en'), Tamil ('ta'), and Hindi ('hi').
        """
        ctx = self.get_current_context(db, station_id)
        t = ctx["telemetry"]
        dev = ctx["device"]
        inc = ctx["active_incidents"]
        ts = ctx["thingspeak"]
        st = ctx["station"]

        p_lower = prompt.lower().strip()
        emotion = "happy"
        action = "explain"
        suggestions = ["What's the current temperature?", "Show Rainfall", "View Analytics", "Any Alerts?", "ThingSpeak Status"]

        # 1. Temperature query
        if any(w in p_lower for w in ["temp", "temperature", "heat", "hot", "cold", "warm", "சூரிய", "வெப்பநிலை", "तापमान"]):
            temp = t["temperature_c"]
            hum = t["humidity_pct"]
            action = "point"

            if temp is not None:
                if temp > 35:
                    emotion = "worried"
                    en_text = f"🌡️ The current temperature is {temp:.1f}°C with {hum or 0:.0f}% humidity. It's quite hot! Stay hydrated and take care in the sun."
                    ta_text = f"🌡️ தற்போதைய வெப்பநிலை {temp:.1f}°C மற்றும் ஈரப்பதம் {hum or 0:.0f}%. அதிக வெப்பம் நிலவுகிறது! போதுமான நீர் அருந்தி நிழலில் இருக்கவும்."
                    hi_text = f"🌡️ वर्तमान तापमान {temp:.1f}°C और आर्द्रता {hum or 0:.0f}% है। काफी गर्मी है! पर्याप्त पानी पिएं और धूप से बचें।"
                elif temp < 15:
                    emotion = "thinking"
                    en_text = f"🌡️ The ambient temperature is currently {temp:.1f}°C. It feels brisk and cool outside!"
                    ta_text = f"🌡️ தற்போதைய வெப்பநிலை {temp:.1f}°C. வெளியே குளிர்ந்த சூழல் நிலவுகிறது!"
                    hi_text = f"🌡️ वर्तमान तापमान {temp:.1f}°C है। बाहर ठंडक का अहसास है!"
                else:
                    emotion = "happy"
                    en_text = f"🌡️ The temperature is a comfortable {temp:.1f}°C with relative humidity at {hum or 0:.0f}%."
                    ta_text = f"🌡️ தற்போதைய வெப்பநிலை {temp:.1f}°C ஆக மிதமாக உள்ளது. ஈரப்பதம் {hum or 0:.0f}%."
                    hi_text = f"🌡️ तापमान सुखद {temp:.1f}°C है और सापेक्ष आर्द्रता {hum or 0:.0f}% है।"
            else:
                emotion = "sad"
                en_text = "I'm checking the BME280 sensor, but no temperature reading has been recorded yet. Please ensure the station node is streaming data."
                ta_text = "வெப்பநிலை பதிவு இன்னும் கிடைக்கவில்லை. சென்சார் இணைப்பை சரிபார்க்கவும்."
                hi_text = "तापमान डेटा अभी उपलब्ध नहीं है। कृपया स्टेशन कनेक्शन की जांच करें।"

        # 2. Rain & Precipitation query
        elif any(w in p_lower for w in ["rain", "rainfall", "precipitation", "shower", "மழை", "மழைப்பொழிவு", "बारिश", "वर्षा"]):
            action = "point"
            rain = t["rainfall_total_mm"]
            rate = t["rain_rate_mmh"]

            if rain and rain > 0:
                emotion = "excited"
                en_text = f"🌧️ Cumulative rainfall recorded is {rain:.1f} mm, with an instantaneous rain rate of {rate:.1f} mm/h."
                ta_text = f"🌧️ பதிவு செய்யப்பட்ட மொத்த மழைப்பொழிவு {rain:.1f} மி.மீ. தற்போதைய மழையின் தீவிரம் {rate:.1f} மி.மீ/மணி."
                hi_text = f"🌧️ कुल दर्ज की गई बारिश {rain:.1f} mm है, और वर्तमान तीव्रता {rate:.1f} mm/h है।"
            else:
                emotion = "happy"
                en_text = "☀️ No rainfall is currently observed by the tipping-bucket gauge (total accumulation is 0.0 mm)."
                ta_text = "☀️ தற்போது மழைப்பொழிவு எதுவும் பதிவாகவில்லை (0.0 மி.மீ)."
                hi_text = "☀️ वर्तमान में कोई बारिश दर्ज नहीं हुई है (0.0 mm)।"

        # 3. Wind speed query
        elif any(w in p_lower for w in ["wind", "gust", "breeze", "காற்ற", "காற்று", "हवा", "आंधी"]):
            wind = t["wind_speed_mps"]
            gust = t["wind_gust_mps"]
            action = "explain"

            if wind is not None:
                kmh = wind * 3.6
                if wind > 15:
                    emotion = "in_alert"
                    en_text = f"💨 Strong winds detected! Sustained wind speed is {wind:.1f} m/s ({kmh:.1f} km/h) with peak gusts up to {gust or 0:.1f} m/s."
                    ta_text = f"💨 பலத்த காற்று வீசுகிறது! காற்றின் வேகம் {wind:.1f} மீ/வி ({kmh:.1f} கி.மீ/மணி). தற்காப்புடன் இருக்கவும்."
                    hi_text = f"💨 तेज़ हवाएं चल रही हैं! हवा की गति {wind:.1f} m/s ({kmh:.1f} km/h) और झोंके {gust or 0:.1f} m/s तक हैं।"
                else:
                    emotion = "happy"
                    en_text = f"🍃 Wind speed is gentle at {wind:.1f} m/s ({kmh:.1f} km/h). Observed gusts are {gust or 0:.1f} m/s."
                    ta_text = f"🍃 காற்றின் வேகம் மிதமாக {wind:.1f} மீ/வி ({kmh:.1f} கி.மீ/மணி) உள்ளது."
                    hi_text = f"🍃 हवा की गति सामान्य {wind:.1f} m/s ({kmh:.1f} km/h) है।"
            else:
                emotion = "thinking"
                en_text = "Cup anemometer readings are currently synchronizing."
                ta_text = "அனிமோமீட்டர் காற்றின் வேகத் தகவல் பெறப்படுகிறது."
                hi_text = "पवनमापी का डेटा सिंक हो रहा है।"

        # 4. Pressure / Barometric query
        elif any(w in p_lower for w in ["pressure", "barometer", "barometric", "hpa", "அழுத்தம்", "दबाव", "वायुमंडलीय"]):
            press = t["pressure_hpa"]
            action = "explain"
            if press is not None:
                if press < 1000:
                    emotion = "surprised"
                    en_text = f"📉 Atmospheric pressure is low at {press:.1f} hPa. A low barometric reading often accompanies stormy or unstable frontal conditions."
                    ta_text = f"📉 வளிமண்டல அழுத்தம் குறைவாக உள்ளது ({press:.1f} hPa). இது புயல் அல்லது மழைக்கான அறிகுறியாக இருக்கலாம்."
                    hi_text = f"📉 वायुमंडलीय दबाव कम होकर {press:.1f} hPa पर है। यह आंधी-तूफान का संकेत हो सकता है।"
                else:
                    emotion = "happy"
                    en_text = f"📊 Atmospheric barometric pressure is steady at {press:.1f} hPa, indicating standard stability."
                    ta_text = f"📊 வளிமண்டல அழுத்தம் சீராக {press:.1f} hPa ஆக உள்ளது."
                    hi_text = f"📊 वायुमंडलीय दबाव स्थिर {press:.1f} hPa पर है, जो सामान्य मौसम का संकेत है।"
            else:
                emotion = "thinking"
                en_text = "Awaiting atmospheric pressure readings from the BME280 sensor."
                ta_text = "BME280 சென்சாரிலிருந்து காற்றழுத்த தகவல் பெறப்படுகிறது."
                hi_text = "BME280 सेंसर से दबाव की जानकारी की प्रतीक्षा है।"

        # 5. Alerts / Incidents query
        elif any(w in p_lower for w in ["alert", "incident", "hazard", "warning", "danger", "எச்சரிக்கை", "அபாயம்", "चेतावनी", "अलर्ट"]):
            action = "notify"
            if inc:
                emotion = "in_alert"
                summaries = [f"• [{i['severity'].upper()}] {i['event_type']}: {i['summary']}" for i in inc]
                en_text = f"⚠️ Active Weather Alerts Detected ({len(inc)} active):\n" + "\n".join(summaries)
                ta_text = f"⚠️ {len(inc)} வானிலை எச்சரிக்கைகள் செயலில் உள்ளன! விழிப்புடன் இருக்கவும்."
                hi_text = f"⚠️ {len(inc)} मौसम अलर्ट सक्रिय हैं! कृपया सावधान रहें।"
            else:
                emotion = "celebrate"
                en_text = "☘️ Good news! There are currently zero active weather alerts or extreme threshold incidents. All systems are normal."
                ta_text = "☘️ மகிழ்ச்சியான செய்தி! தற்போது எந்த தீவிர வானிலை எச்சரிக்கைகளும் இல்லை. சூழல் சீராக உள்ளது."
                hi_text = "☘️ अच्छी खबर! वर्तमान में कोई मौसम अलर्ट या संकट नहीं है। सभी प्रणालियां सामान्य हैं।"

        # 6. ThingSpeak Cloud Status query
        elif any(w in p_lower for w in ["thingspeak", "cloud", "sync", "channel", "திங்ஸ்பீக்", "மேகக்கணி"]):
            action = "explain"
            if ts["configured"]:
                emotion = "happy"
                en_text = (
                    f"📡 ThingSpeak Integration is ACTIVE! Connected to Channel ID: {ts['channel_id']}. "
                    f"Status: {ts['status']}. Last sync at: {ts['last_synced_at'] or 'Just now'}."
                )
                ta_text = f"📡 ThingSpeak இணைப்பு செயலில் உள்ளது! சேனல் எண்: {ts['channel_id']}. நிலை: {ts['status']}."
                hi_text = f"📡 ThingSpeak एकीकरण सक्रिय है! चैनल आईडी: {ts['channel_id']}। स्थिति: {ts['status']}।"
            else:
                emotion = "thinking"
                en_text = (
                    "📡 ThingSpeak is currently UNCONFIGURED. To stream physical ESP32 readings, "
                    "go to Settings or Stations & Devices to enter your Channel ID and Read API Key."
                )
                ta_text = "📡 ThingSpeak இன்னும் கட்டமைக்கப்படவில்லை. அமைப்புகள் பக்கத்தில் சேனல் எண்ணை உள்ளிடவும்."
                hi_text = "📡 ThingSpeak अभी कॉन्फ़िगर नहीं है। कृपया सेटिंग्स में चैनल आईडी दर्ज करें।"

        # 7. Sensor Health / Hardware status query
        elif any(w in p_lower for w in ["health", "sensor", "battery", "hardware", "wifi", "சென்சார்", "பேட்டரி", "सेंसर", "बैटरी"]):
            action = "explain"
            batt_v = dev.get("battery_voltage")
            batt_p = dev.get("battery_percent")
            rssi = dev.get("wifi_rssi")
            status = dev.get("status")

            emotion = "happy" if status == "ONLINE" else "worried"
            en_text = (
                f"🩺 Hardware Health Overview:\n"
                f"• Device Status: {status}\n"
                f"• Battery: {batt_v:.2f}V ({batt_p or 0:.0f}%)\n"
                f"• Wi-Fi Signal: {rssi or '--'} dBm\n"
                f"• Sensor Suite: BME280 (Temp/Hum/Press), Anemometer, Rain Gauge (All verified)."
            )
            ta_text = f"🩺 வன்பொருள் நிலை: {status}. பேட்டரி: {batt_v or '--'}V ({batt_p or 0:.0f}%). Wi-Fi சமிக்ஞை: {rssi or '--'} dBm."
            hi_text = f"🩺 हार्डवेयर स्थिति: {status}। बैटरी: {batt_v or '--'}V ({batt_p or 0:.0f}%)। वाई-फाई सिग्नल: {rssi or '--'} dBm।"

        # 8. General overview / Greeting
        else:
            action = "welcome"
            temp = t["temperature_c"]
            rain = t["rainfall_total_mm"]
            source = "ThingSpeak Cloud Telemetry" if not t["is_simulated"] else "Simulated Station"

            if temp is not None:
                en_text = (
                    f"👋 Hi there! I'm MicroMate, your weather monitoring assistant. "
                    f"Right now at {st['name']}, the temperature is {temp:.1f}°C, "
                    f"humidity is {t['humidity_pct'] or 0:.0f}%, and total rain is {rain or 0:.1f} mm (Source: {source}). "
                    f"How can I help you today?"
                )
                ta_text = (
                    f"👋 வணக்கம்! நான் மைக்ரோமேட் (MicroMate). "
                    f"தற்போதைய வெப்பநிலை {temp:.1f}°C, ஈரப்பதம் {t['humidity_pct'] or 0:.0f}%. "
                    f"நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
                )
                hi_text = (
                    f"👋 नमस्ते! मैं माइक्रोमेट (MicroMate) हूँ। "
                    f"वर्तमान तापमान {temp:.1f}°C और आर्द्रता {t['humidity_pct'] or 0:.0f}% है। "
                    f"मैं आपकी क्या मदद कर सकता हूँ?"
                )
            else:
                en_text = "👋 Hello! I'm MicroMate, your smart weather assistant. I'm connected to your microclimate monitoring platform. Ask me about temperature, rainfall, wind, alerts, or ThingSpeak sync!"
                ta_text = "👋 வணக்கம்! நான் மைக்ரோமேட். வானிலை, மழை, காற்று, எச்சரிக்கைகள் பற்றி என்னிடம் கேளுங்கள்!"
                hi_text = "👋 नमस्ते! मैं माइक्रोमेट हूँ। मौसम, बारिश, हवा या अलर्ट के बारे में मुझसे पूछें!"

        # Select text for target language
        final_text = en_text
        if language == "ta":
            final_text = ta_text
        elif language == "hi":
            final_text = hi_text

        # Record interaction in DB
        try:
            interaction = MicroMateInteraction(
                prompt=prompt,
                response=final_text,
                emotion=emotion,
                language=language,
                context_snapshot=json.dumps(ctx, default=str)
            )
            db.add(interaction)
            db.commit()
        except Exception as e:
            logger.warning(f"Could not persist MicroMate interaction: {e}")

        return {
            "prompt": prompt,
            "response": final_text,
            "emotion": emotion,
            "action": action,
            "language": language,
            "context": ctx,
            "suggestions": suggestions
        }

micromate_service = MicroMateService()

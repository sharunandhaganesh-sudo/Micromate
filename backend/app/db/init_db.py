import json
from datetime import datetime, timezone, timedelta
from backend.app.core.database import engine, SessionLocal, Base
from backend.app.core.security import get_password_hash
from backend.app.models.models import (
    User, Station, Device, DeviceCredential, SensorConfiguration,
    EventRule, Measurement, TelemetryMessage, Incident, IncidentEvidence,
    NotificationPreference, ThingSpeakChannel
)

def utc_now():
    return datetime.now(timezone.utc)

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        measurement_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(measurements)").fetchall()
        }
        if "rain_wetness_pct" not in measurement_columns:
            connection.exec_driver_sql(
                "ALTER TABLE measurements ADD COLUMN rain_wetness_pct FLOAT"
            )
    db = SessionLocal()

    try:
        # Remove legacy demo data before any demo seed records are recreated.
        db.query(DeviceCredential).filter(
            (DeviceCredential.token == "dtoken_demo_esp32_secret_token_12345") |
            (DeviceCredential.mqtt_username == "mqtt_esp32-demo-node")
        ).delete(synchronize_session=False)
        legacy_demo_stations = db.query(Station).filter(
            (Station.is_demo == True) | (Station.name.ilike("%Ridgecrest Observatory%"))
        ).all()
        for legacy_station in legacy_demo_stations:
            db.query(Incident).filter(Incident.station_id == legacy_station.id).delete(synchronize_session=False)
            db.query(Measurement).filter(Measurement.station_id == legacy_station.id).delete(synchronize_session=False)
            db.query(TelemetryMessage).filter(TelemetryMessage.station_id == legacy_station.id).delete(synchronize_session=False)
            db.query(Device).filter(Device.station_id == legacy_station.id).delete(synchronize_session=False)
            db.delete(legacy_station)
        db.query(Measurement).filter(Measurement.is_simulated == True).delete(synchronize_session=False)
        db.query(TelemetryMessage).filter(TelemetryMessage.is_simulated == True).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.is_simulated == True).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.event_type == "SENSOR_MALFUNCTION").delete(synchronize_session=False)
        db.commit()

        # 1. Seed Users if not present
        if not db.query(User).filter(User.username == "admin").first():
            admin_user = User(
                username="admin",
                email="admin@aeropulse.local",
                hashed_password=get_password_hash("AdminPassword2026!"),
                role="admin",
                is_active=True
            )
            operator_user = User(
                username="operator",
                email="operator@aeropulse.local",
                hashed_password=get_password_hash("OperatorPassword2026!"),
                role="operator",
                is_active=True
            )
            viewer_user = User(
                username="viewer",
                email="viewer@aeropulse.local",
                hashed_password=get_password_hash("ViewerPassword2026!"),
                role="viewer",
                is_active=True
            )
            db.add_all([admin_user, operator_user, viewer_user])
            db.flush()

            for u in [admin_user, operator_user, viewer_user]:
                pref = NotificationPreference(
                    user_id=u.id,
                    email_enabled=True,
                    telegram_enabled=False,
                    in_app_enabled=True,
                    min_severity="advisory",
                    notification_email=u.email
                )
                db.add(pref)
            db.commit()

        # 2. Seed Default Detection Rules
        rules = [
            ("RULE_HIGH_TEMP", "High Ambient Heat Advisory", "Triggers when ambient temperature exceeds 38°C", "temperature_c", ">", 38.0, "°C", 35.0, "advisory"),
            ("RULE_HIGH_RAIN_RATE", "High Rain Rate Alert", "Excessive instantaneous rainfall rate exceeding 30 mm/h", "rain_rate_mmh", ">", 30.0, "mm/h", 10.0, "warning"),
            ("RULE_HEAVY_RAIN", "Heavy Storm Rainfall Total", "Cumulative storm rainfall depth exceeding 25 mm", "rainfall_total_mm", ">", 25.0, "mm", 20.0, "warning"),
            ("RULE_STRONG_WIND", "High Wind & Severe Gust", "Instantaneous wind speed exceeding 18 m/s (~65 km/h)", "wind_speed_mps", ">", 18.0, "m/s", 12.0, "warning"),
            ("RULE_PRESSURE_DROP", "Rapid Barometric Drop", "Pressure fall greater than 4 hPa indicating front/squall line", "pressure_drop_3h", "DROP_GREATER_THAN", 4.0, "hPa", 2.0, "warning"),
        ]

        for code, name, desc, metric, op, thresh, unit, rec_thresh, sev in rules:
            if not db.query(EventRule).filter(EventRule.rule_code == code).first():
                r = EventRule(
                    rule_code=code,
                    name=name,
                    description=desc,
                    metric=metric,
                    operator=op,
                    threshold=thresh,
                    unit=unit,
                    recovery_threshold=rec_thresh,
                    severity=sev,
                    cooldown_seconds=300,
                    is_enabled=True,
                    version=1
                )
                db.add(r)
        db.commit()

        # 3. Seed Demo Station & Demo Device
        demo_station = db.query(Station).filter(Station.code == "STATION-DEMO-01").first()
        if not demo_station:
            demo_station = Station(
                code="STATION-DEMO-01",
                name="Ridgecrest Observatory",
                description="High-fidelity demonstration station simulating microclimate conditions and extreme events.",
                location_name="Met Research Campus, Tower A",
                latitude=37.7749,
                longitude=-122.4194,
                timezone="UTC",
                is_demo=True
            )
            db.add(demo_station)
            db.flush()

        demo_device = db.query(Device).filter(Device.device_identifier == "esp32-demo-node").first()
        if demo_station and not demo_device:
            demo_device = Device(
                station_id=demo_station.id,
                device_identifier="esp32-demo-node",
                name="AeroPulse Node 01 (ESP32 Sim)",
                hardware_profile="ESP32-WROOM-32D / BME280 / Anemometer / TippingBucket",
                firmware_version="1.0.0-demo",
                is_demo=True,
                status="ONLINE",
                last_seen_at=utc_now(),
                last_telemetry_at=utc_now(),
                battery_voltage=4.12,
                battery_percent=92.0,
                wifi_rssi=-54
            )
            db.add(demo_device)
            db.flush()

            # Default credentials
            cred = DeviceCredential(
                device_id=demo_device.id,
                token="dtoken_demo_esp32_secret_token_12345",
                mqtt_username="mqtt_esp32-demo-node",
                mqtt_password_hash=get_password_hash("demo_device_password")
            )
            db.add(cred)

            # Sensors
            sensors = [
                ("BME280_TEMP", "I2C:0x76", 1.0, 0.0, 10),
                ("BME280_HUM", "I2C:0x76", 1.0, 0.0, 10),
                ("BME280_PRESS", "I2C:0x76", 1.0, 0.0, 10),
                ("ANEMOMETER", "GPIO14", 1.0, 0.0, 10),
                ("RAIN_GAUGE", "GPIO27", 0.2794, 0.0, 10)
            ]
            for s_type, pin, f, o, interval in sensors:
                s = SensorConfiguration(
                    device_id=demo_device.id,
                    sensor_type=s_type,
                    pin_or_bus=pin,
                    enabled=True,
                    calibration_factor=f,
                    calibration_offset=o,
                    sampling_interval_s=interval
                )
                db.add(s)

            db.commit()

        # 4. Seed 48 hours of realistic baseline measurements so all charts & analytics work on first load
        m_count = db.query(Measurement).filter(Measurement.station_id == demo_station.id).count()
        if m_count < 20:
            now = utc_now()
            start = now - timedelta(hours=48)
            step_min = 10
            total_points = int(48 * 60 / step_min)

            cum_rain = 0.0
            messages = []
            measurements = []

            for i in range(total_points):
                t = start + timedelta(minutes=i * step_min)
                hour_of_day = t.hour + t.minute / 60.0
                # Diurnal temperature cycle: peaks at 14:00 (2pm) at 27°C, minimum at 05:00 at 16°C
                temp_c = round(21.5 + 5.5 * (-(hour_of_day - 14)**2 / 72.0 + 1.0) * 0.8, 2)
                hum_pct = round(max(30.0, min(95.0, 85.0 - (temp_c - 16.0) * 4.0)), 1)
                press_hpa = round(1013.2 + (temp_c - 21.0) * -0.2, 2)
                wind_speed_mps = round(max(0.5, 2.5 + (temp_c - 16.0) * 0.3), 2)
                wind_gust = round(wind_speed_mps * 1.35, 2)

                # Small rain shower at hour 32
                if 28 <= i <= 34:
                    rain_interval = 1.2
                    cum_rain += rain_interval
                    rain_rate = 14.4
                else:
                    rain_interval = 0.0
                    rain_rate = 0.0

                quality_flags = json.dumps({"temp": "VALID", "hum": "VALID", "press": "VALID", "wind": "VALID", "rain": "VALID"})

                msg = TelemetryMessage(
                    device_id=demo_device.id,
                    station_id=demo_station.id,
                    message_id=f"seed-msg-{i}",
                    sequence=i,
                    boot_id="seed-boot-01",
                    device_timestamp=t,
                    received_at=t,
                    uptime_seconds=i * step_min * 60,
                    firmware_version="1.0.0-demo",
                    is_simulated=True
                )
                messages.append(msg)

                meas = Measurement(
                    device_id=demo_device.id,
                    station_id=demo_station.id,
                    timestamp=t,
                    temperature_c=temp_c,
                    humidity_pct=hum_pct,
                    pressure_hpa=press_hpa,
                    wind_speed_mps=wind_speed_mps,
                    wind_gust_mps=wind_gust,
                    rainfall_interval_mm=rain_interval,
                    rainfall_total_mm=round(cum_rain, 2),
                    rain_rate_mmh=rain_rate,
                    quality_flags=quality_flags,
                    is_simulated=True
                )
                measurements.append(meas)

            db.add_all(messages)
            db.add_all(measurements)
            db.commit()

        # Remove legacy demo and Ridgecrest Observatory data after seeding/checking.
        demo_stations = db.query(Station).filter(
            (Station.is_demo == True) | (Station.name.ilike("%Ridgecrest Observatory%"))
        ).all()

        db.query(DeviceCredential).filter(
            (DeviceCredential.token == "dtoken_demo_esp32_secret_token_12345") |
            (DeviceCredential.mqtt_username == "mqtt_esp32-demo-node")
        ).delete(synchronize_session=False)
        db.query(Measurement).filter(Measurement.is_simulated == True).delete(synchronize_session=False)
        db.query(TelemetryMessage).filter(TelemetryMessage.is_simulated == True).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.is_simulated == True).delete(synchronize_session=False)

        for station in demo_stations:
            db.query(Incident).filter(Incident.station_id == station.id).delete(synchronize_session=False)
            db.query(Measurement).filter(Measurement.station_id == station.id).delete(synchronize_session=False)
            db.query(TelemetryMessage).filter(TelemetryMessage.station_id == station.id).delete(synchronize_session=False)
            demo_devices = db.query(Device).filter(Device.station_id == station.id).all()
            for demo_device in demo_devices:
                db.query(DeviceCredential).filter(DeviceCredential.device_id == demo_device.id).delete(synchronize_session=False)
                db.query(SensorConfiguration).filter(SensorConfiguration.device_id == demo_device.id).delete(synchronize_session=False)
            db.query(Device).filter(Device.station_id == station.id).delete(synchronize_session=False)
            db.delete(station)

        db.commit()

        # 5. Initialize ThingSpeak Channel if not present
        if not db.query(ThingSpeakChannel).first():
            ts_ch = ThingSpeakChannel(
                channel_id="UNCONFIGURED",
                channel_name="Primary Weather Station Channel",
                read_api_key=None,
                write_api_key=None,
                is_enabled=False,
                field_mapping=json.dumps({
                    "field1": "temperature_c",
                    "field2": "humidity_pct",
                    "field3": "pressure_hpa",
                    "field4": "wind_speed_mps",
                    "field5": "rainfall_total_mm",
                    "field6": "battery_voltage_v",
                    "field7": "wifi_rssi_dbm",
                    "field8": "rain_rate_mmh"
                }),
                sync_interval_seconds=20,
                status="UNCONFIGURED"
            )
            db.add(ts_ch)
            db.commit()

    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")

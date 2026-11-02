import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash
from backend.app.models.models import (
    Device, DeviceCredential, SensorConfiguration, CalibrationRecord, AuditLog, User
)
from backend.app.schemas.schemas import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceCredentialResponse,
    SensorConfigResponse, SensorConfigUpdate, CalibrationRecordCreate, CalibrationRecordResponse
)
from backend.app.api.deps import require_operator, require_admin

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.get("", response_model=List[DeviceResponse])
def list_devices(
    station_id: Optional[str] = None,
    is_demo: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Device)
    if station_id:
        q = q.filter(Device.station_id == station_id)
    if is_demo is not None:
        q = q.filter(Device.is_demo == is_demo)
    return [DeviceResponse.model_validate(d) for d in q.order_by(Device.created_at.asc()).all()]

@router.post("", response_model=DeviceResponse)
def register_device(
    device_in: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    existing = db.query(Device).filter(Device.device_identifier == device_in.device_identifier).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Device identifier '{device_in.device_identifier}' is already registered."
        )

    device = Device(
        station_id=device_in.station_id,
        device_identifier=device_in.device_identifier,
        name=device_in.name,
        hardware_profile=device_in.hardware_profile,
        firmware_version=device_in.firmware_version,
        is_demo=device_in.is_demo,
        status="NEVER_CONNECTED",
        notes=device_in.notes
    )
    db.add(device)
    db.flush()

    # Generate initial credentials
    raw_token = f"dtoken_{secrets.token_urlsafe(24)}"
    mqtt_pass = secrets.token_urlsafe(16)
    cred = DeviceCredential(
        device_id=device.id,
        token=raw_token,
        mqtt_username=f"mqtt_{device.device_identifier}",
        mqtt_password_hash=get_password_hash(mqtt_pass)
    )
    db.add(cred)

    # Pre-populate default sensor configurations for ESP32 station
    default_sensors = [
        ("BME280_TEMP", "I2C:0x76", 1.0, 0.0, 10),
        ("BME280_HUM", "I2C:0x76", 1.0, 0.0, 10),
        ("BME280_PRESS", "I2C:0x76", 1.0, 0.0, 10),
        ("ANEMOMETER", "GPIO14", 1.0, 0.0, 10),
        ("RAIN_GAUGE", "GPIO27", 0.2794, 0.0, 10),  # standard 0.2794 mm per bucket tip
    ]
    for s_type, pin, factor, offset, interval in default_sensors:
        s_cfg = SensorConfiguration(
            device_id=device.id,
            sensor_type=s_type,
            pin_or_bus=pin,
            enabled=True,
            calibration_factor=factor,
            calibration_offset=offset,
            sampling_interval_s=interval
        )
        db.add(s_cfg)

    db.commit()
    db.refresh(device)
    return DeviceResponse.model_validate(device)

@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: str, db: Session = Depends(get_db)):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return DeviceResponse.model_validate(dev)

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: str,
    device_in: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    for field, val in device_in.model_dump(exclude_unset=True).items():
        setattr(dev, field, val)

    db.commit()
    db.refresh(dev)
    return DeviceResponse.model_validate(dev)

@router.delete("/{device_id}")
def delete_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(dev)
    db.commit()
    return {"message": f"Device {dev.name} deleted successfully"}

@router.get("/{device_id}/credentials")
def get_device_credentials(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    cred = db.query(DeviceCredential).filter(
        DeviceCredential.device_id == dev.id,
        DeviceCredential.is_revoked == False
    ).first()

    if not cred:
        raw_token = f"dtoken_{secrets.token_urlsafe(24)}"
        cred = DeviceCredential(
            device_id=dev.id,
            token=raw_token,
            mqtt_username=f"mqtt_{dev.device_identifier}",
            mqtt_password_hash=None
        )
        db.add(cred)
        db.commit()
        db.refresh(cred)

    return {
        "device_id": dev.id,
        "device_identifier": dev.device_identifier,
        "http_token": cred.token,
        "mqtt_username": cred.mqtt_username,
        "mqtt_topic_telemetry": f"microclimate/v1/devices/{dev.device_identifier}/telemetry",
        "mqtt_topic_status": f"microclimate/v1/devices/{dev.device_identifier}/status"
    }

@router.get("/{device_id}/sensors", response_model=List[SensorConfigResponse])
def get_device_sensors(device_id: str, db: Session = Depends(get_db)):
    sensors = db.query(SensorConfiguration).filter(SensorConfiguration.device_id == device_id).all()
    return [SensorConfigResponse.model_validate(s) for s in sensors]

@router.put("/{device_id}/sensors/{sensor_id}", response_model=SensorConfigResponse)
def update_sensor_config(
    device_id: str,
    sensor_id: str,
    sensor_in: SensorConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    sensor = db.query(SensorConfiguration).filter(
        SensorConfiguration.id == sensor_id,
        SensorConfiguration.device_id == device_id
    ).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor configuration not found")

    for f, v in sensor_in.model_dump(exclude_unset=True).items():
        setattr(sensor, f, v)

    db.commit()
    db.refresh(sensor)
    return SensorConfigResponse.model_validate(sensor)

@router.post("/{device_id}/calibrate", response_model=CalibrationRecordResponse)
def add_calibration_record(
    device_id: str,
    calib_in: CalibrationRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator)
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    # Update sensor config with calibration factor & offset
    sensor = db.query(SensorConfiguration).filter(
        SensorConfiguration.device_id == device_id,
        SensorConfiguration.sensor_type == calib_in.sensor_type
    ).first()
    if sensor:
        sensor.calibration_factor = calib_in.calibration_factor
        sensor.calibration_offset = calib_in.calibration_offset

    rec = CalibrationRecord(
        device_id=device_id,
        sensor_type=calib_in.sensor_type,
        calibration_factor=calib_in.calibration_factor,
        calibration_offset=calib_in.calibration_offset,
        performed_by=calib_in.performed_by,
        notes=calib_in.notes
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return CalibrationRecordResponse.model_validate(rec)

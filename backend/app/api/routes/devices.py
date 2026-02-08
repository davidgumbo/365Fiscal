from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access, require_admin
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceRead
from app.services.fdms import get_status, open_day, close_day, get_config, ping_device, register_device

router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[Depends(require_admin)])


@router.get("/values")
def list_device_values(
    field: str,
    company_id: int | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    """Return distinct values for a given device field (e.g., 'status').

    Optional `company_id` can scope values to a single company.
    """
    if field == "status":
        query = db.query(Device.fiscal_day_status).distinct()
        if company_id:
            query = query.filter(Device.company_id == company_id)
        if q:
            query = query.filter(Device.fiscal_day_status.ilike(f"%{q}%"))
        results = [r[0] for r in query.order_by(Device.fiscal_day_status).all() if r[0]]
        return results
    # Unknown field -> empty list
    return []


@router.post("", response_model=DeviceRead)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, payload.company_id)
    device = Device(**payload.dict())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("", response_model=list[DeviceRead])
def list_devices(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    search: str | None = None,
    status: str | None = None,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    _=Depends(require_company_access),
):
    query = db.query(Device).filter(Device.company_id == company_id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            Device.device_id.ilike(like)
            | Device.serial_number.ilike(like)
            | Device.model.ilike(like)
        )
    if status:
        query = query.filter(Device.fiscal_day_status == status)
    if date_from:
        query = query.filter(Device.created_at >= date_from)
    if date_to:
        query = query.filter(Device.created_at <= date_to)
    return query.all()


@router.post("/{device_id}/crt", response_model=DeviceRead)
def upload_crt(
    device_id: int,
    crt: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if device:
        ensure_company_access(db, user, device.company_id)
        device.crt_filename = crt.filename
        device.crt_data = crt.file.read()
        db.commit()
        db.refresh(device)
    return device


@router.post("/{device_id}/key", response_model=DeviceRead)
def upload_key(
    device_id: int,
    key: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if device:
        ensure_company_access(db, user, device.company_id)
        device.key_filename = key.filename
        device.key_data = key.file.read()
        db.commit()
        db.refresh(device)
    return device


@router.get("/{device_id}/status")
def fetch_status(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    status = get_status(device, db)
    return status


@router.get("/{device_id}/config")
def fetch_config(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    return get_config(device, db)


@router.get("/{device_id}/ping")
def ping(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    return ping_device(device, db)


@router.post("/{device_id}/register")
def register(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    return register_device(device, db)


@router.post("/{device_id}/open-day")
def open_fiscal_day(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    result = open_day(device, db)
    device.fiscal_day_status = result.get("fiscalDayStatus", device.fiscal_day_status)
    device.current_fiscal_day_no = result.get("currentFiscalDayNo", device.current_fiscal_day_no)
    device.last_fiscal_day_no = result.get("lastFiscalDayNo", device.last_fiscal_day_no)
    db.commit()
    return result


@router.post("/{device_id}/close-day")
def close_fiscal_day(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None
    ensure_company_access(db, user, device.company_id)
    result = close_day(device, db)
    device.fiscal_day_status = result.get("fiscalDayStatus", device.fiscal_day_status)
    device.last_fiscal_day_no = result.get("lastFiscalDayNo", device.last_fiscal_day_no)
    db.commit()
    return result

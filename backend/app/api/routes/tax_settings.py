from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access
from app.models.tax_setting import TaxSetting
from app.models.device import Device
from app.schemas.tax_setting import TaxSettingCreate, TaxSettingRead, TaxSettingUpdate
from app.services import fdms as fdms_service

router = APIRouter(prefix="/tax-settings", tags=["tax-settings"])


@router.post("", response_model=TaxSettingRead)
def create_tax_setting(
    payload: TaxSettingCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, payload.company_id)
    setting = TaxSetting(**payload.dict())
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.get("", response_model=list[TaxSettingRead])
def list_tax_settings(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_company_access),
):
    return db.query(TaxSetting).filter(TaxSetting.company_id == company_id).all()


@router.patch("/{tax_id}", response_model=TaxSettingRead)
def update_tax_setting(
    tax_id: int,
    payload: TaxSettingUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    setting = db.query(TaxSetting).filter(TaxSetting.id == tax_id).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Tax setting not found")
    ensure_company_access(db, user, setting.company_id)
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(setting, key, value)
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/{tax_id}")
def delete_tax_setting(
    tax_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    setting = db.query(TaxSetting).filter(TaxSetting.id == tax_id).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Tax setting not found")
    ensure_company_access(db, user, setting.company_id)
    db.delete(setting)
    db.commit()
    return {"status": "deleted"}


@router.post("/pull-from-fdms", response_model=list[TaxSettingRead])
def pull_taxes_from_fdms(
    device_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Call GetConfig on the specified FDMS device and upsert ZIMRA taxes."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    ensure_company_access(db, user, device.company_id)

    try:
        config = fdms_service.get_config(device, db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FDMS GetConfig failed: {e}")

    applicable_taxes = config.get("applicableTaxes", [])
    if not applicable_taxes:
        raise HTTPException(status_code=404, detail="No taxes returned by FDMS GetConfig")

    company_id = device.company_id
    upserted: list[TaxSetting] = []

    for tax_data in applicable_taxes:
        zimra_tax_id = tax_data.get("taxID")
        tax_name = tax_data.get("taxName", "")
        tax_code = tax_data.get("taxCode", "")
        tax_percent = tax_data.get("taxPercent")
        valid_from = tax_data.get("taxValidFrom")
        valid_till = tax_data.get("taxValidTill")

        # Normalize dates to YYYY-MM-DD
        valid_from_str = str(valid_from)[:10] if valid_from else None
        valid_till_str = str(valid_till)[:10] if valid_till else None

        # Normalize percent
        try:
            rate = float(tax_percent) if tax_percent is not None else 0.0
        except (ValueError, TypeError):
            rate = 0.0

        is_exempt = "exempt" in (tax_name or "").lower() or rate == 0

        # Try to find existing by zimra_tax_id + company
        existing = (
            db.query(TaxSetting)
            .filter(
                TaxSetting.company_id == company_id,
                TaxSetting.zimra_tax_id == zimra_tax_id,
                TaxSetting.is_zimra_tax == True,
            )
            .first()
        )

        if existing:
            existing.name = tax_name or existing.name
            existing.rate = rate
            existing.zimra_tax_code = tax_code or ""
            existing.zimra_valid_from = valid_from_str
            existing.zimra_valid_till = valid_till_str
            existing.zimra_code = tax_code or ""
            existing.label_on_invoice = tax_name or existing.label_on_invoice
            upserted.append(existing)
        else:
            new_tax = TaxSetting(
                company_id=company_id,
                name=tax_name or f"ZIMRA {tax_percent}%",
                description=f"ZIMRA Tax ID: {zimra_tax_id}" if zimra_tax_id else f"ZIMRA Tax: {tax_name}",
                tax_type="sales",
                tax_scope="sales",
                label_on_invoice=tax_name or f"ZIMRA {tax_percent}%",
                rate=rate,
                zimra_code=tax_code or "",
                is_active=True,
                zimra_tax_id=zimra_tax_id,
                zimra_tax_code=tax_code or "",
                zimra_valid_from=valid_from_str,
                zimra_valid_till=valid_till_str,
                is_zimra_tax=True,
            )
            db.add(new_tax)
            upserted.append(new_tax)

    db.commit()
    for t in upserted:
        db.refresh(t)

    return upserted

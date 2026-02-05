from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access
from app.models.tax_setting import TaxSetting
from app.schemas.tax_setting import TaxSettingCreate, TaxSettingRead, TaxSettingUpdate

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

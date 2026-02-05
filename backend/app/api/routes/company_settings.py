from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, ensure_company_access, require_company_access, require_portal_user
from app.models.company_settings import CompanySettings
from app.schemas.company_settings import CompanySettingsCreate, CompanySettingsRead, CompanySettingsUpdate

router = APIRouter(prefix="/company-settings", tags=["company-settings"])


@router.post("", response_model=CompanySettingsRead)
def create_company_settings(
    payload: CompanySettingsCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, payload.company_id)
    
    # Check if settings already exist
    existing = db.query(CompanySettings).filter(
        CompanySettings.company_id == payload.company_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Settings already exist for this company")
    
    settings = CompanySettings(**payload.dict())
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("", response_model=CompanySettingsRead | None)
def get_company_settings(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
    _=Depends(require_company_access),
):
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()
    
    if not settings:
        # Create default settings if none exist
        settings = CompanySettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@router.patch("/{settings_id}", response_model=CompanySettingsRead)
def update_company_settings(
    settings_id: int,
    payload: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    settings = db.query(CompanySettings).filter(CompanySettings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    ensure_company_access(db, user, settings.company_id)
    
    updates = payload.dict(exclude_unset=True)
    for key, value in updates.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings

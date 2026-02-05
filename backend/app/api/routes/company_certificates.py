from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access
from app.models.company_certificate import CompanyCertificate
from app.schemas.company_certificate import CompanyCertificateRead

router = APIRouter(prefix="/company-certificates", tags=["company-certificates"])


@router.get("", response_model=CompanyCertificateRead | None)
def get_certificate(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, company_id)
    return db.query(CompanyCertificate).filter(CompanyCertificate.company_id == company_id).first()


@router.post("/{company_id}/crt", response_model=CompanyCertificateRead)
def upload_company_crt(
    company_id: int,
    crt: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, company_id)
    cert = db.query(CompanyCertificate).filter(CompanyCertificate.company_id == company_id).first()
    if not cert:
        cert = CompanyCertificate(company_id=company_id)
        db.add(cert)
    cert.crt_filename = crt.filename
    cert.crt_data = crt.file.read()
    db.commit()
    db.refresh(cert)
    return cert


@router.post("/{company_id}/key", response_model=CompanyCertificateRead)
def upload_company_key(
    company_id: int,
    key: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, company_id)
    cert = db.query(CompanyCertificate).filter(CompanyCertificate.company_id == company_id).first()
    if not cert:
        cert = CompanyCertificate(company_id=company_id)
        db.add(cert)
    cert.key_filename = key.filename
    cert.key_data = key.file.read()
    db.commit()
    db.refresh(cert)
    return cert
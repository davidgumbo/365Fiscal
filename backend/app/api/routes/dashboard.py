from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.models.company import Company
from app.models.company_user import CompanyUser
from app.models.device import Device
from app.models.company_certificate import CompanyCertificate
from app.models.user import User
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
) -> DashboardSummary:
    if user.is_admin:
        company_ids = [cid for (cid,) in db.query(Company.id).all()]
    else:
        company_ids = [
            cid
            for (cid,) in (
                db.query(CompanyUser.company_id)
                .filter(CompanyUser.user_id == user.id, CompanyUser.is_active == True)
                .all()
            )
        ]

    if not company_ids:
        return DashboardSummary.empty()

    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    devices = db.query(Device).filter(Device.company_id.in_(company_ids)).all()
    devices_total = len(devices)
    devices_online = sum(1 for device in devices if device.updated_at and device.updated_at >= cutoff)
    devices_attention = max(devices_total - devices_online, 0)

    week_start = now - timedelta(weeks=11)
    week_start = week_start - timedelta(days=week_start.weekday())
    invoice_trend: list[dict[str, int | str]] = []
    quotation_trend: list[dict[str, int | str]] = []
    for idx in range(12):
        start = week_start + timedelta(weeks=idx)
        label = start.strftime("%d %b")
        invoice_trend.append({"label": label, "value": 0})
        quotation_trend.append({"label": label, "value": 0})

    companies = db.query(Company).filter(Company.id.in_(company_ids)).all()
    company_status = []
    total_certificate_days = 0
    certificate_count = 0
    validation_errors = 0
    for company in companies:
        company_devices = company.devices
        open_day = any(device.fiscal_day_status == "open" for device in company_devices)
        close_status = "Closed" if all(
            device.fiscal_day_status == "closed" for device in company_devices
        ) else "Open"
        last_sync = max((device.updated_at for device in company_devices if device.updated_at), default=None)
        last_fiscal_day = max(
            (
                max(device.current_fiscal_day_no, device.last_fiscal_day_no)
                for device in company_devices
            ),
            default=0,
        )
        company_online = sum(1 for device in company_devices if device.updated_at and device.updated_at >= cutoff)
        cert = (
            db.query(CompanyCertificate)
            .filter(CompanyCertificate.company_id == company.id)
            .first()
        )
        cert_days = (cert.expires_at - now).days if cert and cert.expires_at else None
        if cert_days is not None:
            total_certificate_days += max(cert_days, 0)
            certificate_count += 1
        cert_status = "Missing"
        if cert_days is not None:
            cert_status = "Expired" if cert_days < 0 else "Valid"
        if cert_status != "Valid":
            validation_errors += 1
        company_status.append(
            {
                "company_id": company.id,
                "company_name": company.name,
                "device_count": len(company_devices),
                "devices_online": company_online,
                "open_day_status": "Open" if open_day else "Closed",
                "close_status": close_status,
                "last_fiscal_day_no": last_fiscal_day,
                "last_sync": last_sync,
                "certificate_status": cert_status,
                "certificate_days_remaining": cert_days,
            }
        )

    avg_certificate_days = int(total_certificate_days / certificate_count) if certificate_count else 0

    return DashboardSummary(
        metrics={
            "active_companies": len(company_ids),
            "avg_certificate_days": avg_certificate_days,
            "companies_with_errors": validation_errors,
            "devices_online": devices_online,
            "devices_total": devices_total,
        },
        trends={"invoices": invoice_trend, "quotations": quotation_trend},
        device_health={"online": devices_online, "attention": devices_attention},
        company_status=company_status,
    )

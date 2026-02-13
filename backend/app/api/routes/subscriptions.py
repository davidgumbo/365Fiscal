import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, get_current_user, require_portal_user
from app.models.company import Company
from app.models.company_user import CompanyUser
from app.models.subscription import Subscription, ActivationCode
from app.models.user import User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


# ── Schemas ──────────────────────────────────────────

class SubscriptionRead(BaseModel):
    id: int
    company_id: int
    plan: str
    status: str
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    max_users: int
    max_devices: int
    max_invoices_per_month: int
    notes: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionUpdate(BaseModel):
    plan: Optional[str] = None
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    max_users: Optional[int] = None
    max_devices: Optional[int] = None
    max_invoices_per_month: Optional[int] = None
    notes: Optional[str] = None


class SubscriptionCreate(BaseModel):
    company_id: int
    plan: str = "starter"
    duration_days: int = 365
    max_users: int = 5
    max_devices: int = 2
    max_invoices_per_month: int = 500
    notes: str = ""


class GenerateCodeRequest(BaseModel):
    company_id: int
    plan: str = "starter"
    duration_days: int = 365
    max_users: int = 5
    max_devices: int = 2
    max_invoices_per_month: int = 500


class ActivationCodeRead(BaseModel):
    id: int
    code: str
    company_id: int
    plan: str
    duration_days: int
    max_users: int
    max_devices: int
    max_invoices_per_month: int
    is_used: bool
    used_by_user_id: Optional[int] = None
    used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActivateRequest(BaseModel):
    code: str


class ActivationStatusRead(BaseModel):
    activated: bool
    plan: Optional[str] = None
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    company_name: Optional[str] = None


# ── Helpers ──────────────────────────────────────────

def _generate_code(length: int = 16) -> str:
    """Generate a human-friendly activation code like XXXX-XXXX-XXXX-XXXX."""
    chars = string.ascii_uppercase + string.digits
    raw = "".join(secrets.choice(chars) for _ in range(length))
    return "-".join(raw[i:i + 4] for i in range(0, length, 4))


# ── Admin endpoints ──────────────────────────────────

@router.get("", response_model=list[SubscriptionRead])
def list_subscriptions(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = db.query(Subscription)
    if company_id:
        q = q.filter(Subscription.company_id == company_id)
    return q.order_by(Subscription.id.desc()).all()


@router.post("", response_model=SubscriptionRead)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    existing = db.query(Subscription).filter(Subscription.company_id == payload.company_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company already has a subscription. Update it instead.")

    now = datetime.now(timezone.utc)
    sub = Subscription(
        company_id=payload.company_id,
        plan=payload.plan,
        status="active",
        starts_at=now,
        expires_at=now + timedelta(days=payload.duration_days),
        max_users=payload.max_users,
        max_devices=payload.max_devices,
        max_invoices_per_month=payload.max_invoices_per_month,
        notes=payload.notes,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.patch("/{subscription_id}", response_model=SubscriptionRead)
def update_subscription(
    subscription_id: int,
    payload: SubscriptionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subscription_id}")
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    return {"status": "deleted"}


# ── Activation codes ─────────────────────────────────

@router.post("/generate-code", response_model=ActivationCodeRead)
def generate_activation_code(
    payload: GenerateCodeRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    code = _generate_code()
    # Ensure uniqueness
    while db.query(ActivationCode).filter(ActivationCode.code == code).first():
        code = _generate_code()

    ac = ActivationCode(
        code=code,
        company_id=payload.company_id,
        plan=payload.plan,
        duration_days=payload.duration_days,
        max_users=payload.max_users,
        max_devices=payload.max_devices,
        max_invoices_per_month=payload.max_invoices_per_month,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),  # Code valid for 30 days
    )
    db.add(ac)
    db.commit()
    db.refresh(ac)
    return ac


@router.get("/codes", response_model=list[ActivationCodeRead])
def list_activation_codes(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = db.query(ActivationCode)
    if company_id:
        q = q.filter(ActivationCode.company_id == company_id)
    return q.order_by(ActivationCode.id.desc()).all()


@router.delete("/codes/{code_id}")
def delete_activation_code(
    code_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ac = db.query(ActivationCode).filter(ActivationCode.id == code_id).first()
    if not ac:
        raise HTTPException(status_code=404, detail="Code not found")
    db.delete(ac)
    db.commit()
    return {"status": "deleted"}


# ── Portal user endpoints ────────────────────────────

@router.post("/activate", response_model=ActivationStatusRead)
def activate_subscription(
    payload: ActivateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_portal_user),
):
    """Portal user enters an activation code to activate their company subscription."""
    code_str = payload.code.strip().upper()
    ac = db.query(ActivationCode).filter(ActivationCode.code == code_str).first()

    if not ac:
        raise HTTPException(status_code=404, detail="Invalid activation code")
    if ac.is_used:
        raise HTTPException(status_code=400, detail="This code has already been used")
    if ac.expires_at and ac.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This code has expired")

    # Check user belongs to the company
    link = db.query(CompanyUser).filter(
        CompanyUser.user_id == user.id,
        CompanyUser.company_id == ac.company_id,
        CompanyUser.is_active == True,
    ).first()

    if not link and not user.is_admin:
        raise HTTPException(status_code=403, detail="You are not a member of the company this code is for")

    # Create or update subscription for the company
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.company_id == ac.company_id).first()

    if sub:
        # Extend or update existing subscription
        sub.plan = ac.plan
        sub.status = "active"
        sub.starts_at = now
        sub.expires_at = now + timedelta(days=ac.duration_days)
        sub.max_users = ac.max_users
        sub.max_devices = ac.max_devices
        sub.max_invoices_per_month = ac.max_invoices_per_month
    else:
        sub = Subscription(
            company_id=ac.company_id,
            plan=ac.plan,
            status="active",
            starts_at=now,
            expires_at=now + timedelta(days=ac.duration_days),
            max_users=ac.max_users,
            max_devices=ac.max_devices,
            max_invoices_per_month=ac.max_invoices_per_month,
        )
        db.add(sub)

    # Mark code as used
    ac.is_used = True
    ac.used_by_user_id = user.id
    ac.used_at = now

    db.commit()
    db.refresh(sub)

    company = db.query(Company).filter(Company.id == ac.company_id).first()

    return ActivationStatusRead(
        activated=True,
        plan=sub.plan,
        status=sub.status,
        expires_at=sub.expires_at,
        company_name=company.name if company else None,
    )


@router.get("/my-status", response_model=list[ActivationStatusRead])
def my_subscription_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_portal_user),
):
    """Get subscription status for all companies the current user belongs to."""
    links = db.query(CompanyUser).filter(
        CompanyUser.user_id == user.id,
        CompanyUser.is_active == True,
    ).all()

    results = []
    for link in links:
        company = db.query(Company).filter(Company.id == link.company_id).first()
        sub = db.query(Subscription).filter(Subscription.company_id == link.company_id).first()

        if sub:
            # Auto-expire if past date
            if sub.expires_at and sub.expires_at < datetime.now(timezone.utc) and sub.status == "active":
                sub.status = "expired"
                db.commit()

            results.append(ActivationStatusRead(
                activated=True,
                plan=sub.plan,
                status=sub.status,
                expires_at=sub.expires_at,
                company_name=company.name if company else None,
            ))
        else:
            results.append(ActivationStatusRead(
                activated=False,
                company_name=company.name if company else None,
            ))

    return results

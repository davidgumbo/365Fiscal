from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, get_current_user
from app.models.company_user import CompanyUser
from app.models.user import User
from app.models.company import Company
from app.models.device import Device
from app.models.company_certificate import CompanyCertificate
from app.models.warehouse import Warehouse
from app.models.location import Location
from app.models.tax_setting import TaxSetting
from app.models.quotation import Quotation
from app.models.quotation_line import QuotationLine
from app.models.product import Product
from app.models.invoice import Invoice
from app.models.contact import Contact
from app.models.category import Category
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])


def apply_company_filters(
    query,
    search: str | None,
    tin: str | None,
    tin_exact: str | None,
    tin_starts: str | None,
    tin_ends: str | None,
    vat: str | None,
    vat_exact: str | None,
    vat_starts: str | None,
    vat_ends: str | None,
    email: str | None,
    email_exact: str | None,
    email_starts: str | None,
    email_ends: str | None,
    phone: str | None,
    phone_exact: str | None,
    phone_starts: str | None,
    phone_ends: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
):
    if search:
        like = f"%{search}%"
        query = query.filter(
            Company.name.ilike(like)
            | Company.address.ilike(like)
            | Company.email.ilike(like)
            | Company.phone.ilike(like)
            | Company.tin.ilike(like)
            | Company.vat.ilike(like)
        )
    if tin:
        query = query.filter(Company.tin.ilike(f"%{tin}%"))
    if tin_exact:
        query = query.filter(Company.tin == tin_exact)
    if tin_starts:
        query = query.filter(Company.tin.ilike(f"{tin_starts}%"))
    if tin_ends:
        query = query.filter(Company.tin.ilike(f"%{tin_ends}"))

    if vat:
        query = query.filter(Company.vat.ilike(f"%{vat}%"))
    if vat_exact:
        query = query.filter(Company.vat == vat_exact)
    if vat_starts:
        query = query.filter(Company.vat.ilike(f"{vat_starts}%"))
    if vat_ends:
        query = query.filter(Company.vat.ilike(f"%{vat_ends}"))

    if email:
        query = query.filter(Company.email.ilike(f"%{email}%"))
    if email_exact:
        query = query.filter(Company.email == email_exact)
    if email_starts:
        query = query.filter(Company.email.ilike(f"{email_starts}%"))
    if email_ends:
        query = query.filter(Company.email.ilike(f"%{email_ends}"))

    if phone:
        query = query.filter(Company.phone.ilike(f"%{phone}%"))
    if phone_exact:
        query = query.filter(Company.phone == phone_exact)
    if phone_starts:
        query = query.filter(Company.phone.ilike(f"{phone_starts}%"))
    if phone_ends:
        query = query.filter(Company.phone.ilike(f"%{phone_ends}"))

    if date_from:
        query = query.filter(Company.created_at >= date_from)
    if date_to:
        query = query.filter(Company.created_at <= date_to)
    return query


@router.post("", response_model=CompanyRead, dependencies=[Depends(require_admin)])
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    company = Company(
        name=payload.name,
        address=payload.address,
        email=payload.email or "",
        phone=payload.phone,
        tin=payload.tin,
        vat=payload.vat,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.patch("/{company_id}", response_model=CompanyRead, dependencies=[Depends(require_admin)])
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", dependencies=[Depends(require_admin)])
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # Delete all associated records first (order matters due to FK constraints)
    # First get all quotation IDs for this company to delete their lines
    quotation_ids = [q.id for q in db.query(Quotation.id).filter(Quotation.company_id == company_id).all()]
    if quotation_ids:
        db.query(QuotationLine).filter(QuotationLine.quotation_id.in_(quotation_ids)).delete(synchronize_session=False)
    db.query(Invoice).filter(Invoice.company_id == company_id).delete()
    db.query(Quotation).filter(Quotation.company_id == company_id).delete()
    db.query(Product).filter(Product.company_id == company_id).delete()
    db.query(Contact).filter(Contact.company_id == company_id).delete()
    db.query(Category).filter(Category.company_id == company_id).delete()
    db.query(Device).filter(Device.company_id == company_id).delete()
    # Get warehouse IDs and delete locations first
    warehouse_ids = [w.id for w in db.query(Warehouse.id).filter(Warehouse.company_id == company_id).all()]
    if warehouse_ids:
        db.query(Location).filter(Location.warehouse_id.in_(warehouse_ids)).delete(synchronize_session=False)
    db.query(Warehouse).filter(Warehouse.company_id == company_id).delete()
    db.query(TaxSetting).filter(TaxSetting.company_id == company_id).delete()
    db.query(CompanyCertificate).filter(CompanyCertificate.company_id == company_id).delete()
    db.query(CompanyUser).filter(CompanyUser.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"detail": "Company deleted"}


@router.get("", response_model=list[CompanyRead], dependencies=[Depends(require_admin)])
def list_companies(
    db: Session = Depends(get_db),
    search: str | None = None,
    tin: str | None = None,
    tin_exact: str | None = None,
    tin_starts: str | None = None,
    tin_ends: str | None = None,
    vat: str | None = None,
    vat_exact: str | None = None,
    vat_starts: str | None = None,
    vat_ends: str | None = None,
    email: str | None = None,
    email_exact: str | None = None,
    email_starts: str | None = None,
    email_ends: str | None = None,
    phone: str | None = None,
    phone_exact: str | None = None,
    phone_starts: str | None = None,
    phone_ends: str | None = None,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
):
    query = db.query(Company)
    query = apply_company_filters(
        query,
        search,
        tin,
        tin_exact,
        tin_starts,
        tin_ends,
        vat,
        vat_exact,
        vat_starts,
        vat_ends,
        email,
        email_exact,
        email_starts,
        email_ends,
        phone,
        phone_exact,
        phone_starts,
        phone_ends,
        date_from,
        date_to,
    )
    return query.all()


@router.get("/me", response_model=list[CompanyRead])
def list_my_companies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    search: str | None = None,
    tin: str | None = None,
    tin_exact: str | None = None,
    tin_starts: str | None = None,
    tin_ends: str | None = None,
    vat: str | None = None,
    vat_exact: str | None = None,
    vat_starts: str | None = None,
    vat_ends: str | None = None,
    email: str | None = None,
    email_exact: str | None = None,
    email_starts: str | None = None,
    email_ends: str | None = None,
    phone: str | None = None,
    phone_exact: str | None = None,
    phone_starts: str | None = None,
    phone_ends: str | None = None,
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
):
    if user.is_admin:
        query = db.query(Company)
        query = apply_company_filters(
            query,
            search,
            tin,
            tin_exact,
            tin_starts,
            tin_ends,
            vat,
            vat_exact,
            vat_starts,
            vat_ends,
            email,
            email_exact,
            email_starts,
            email_ends,
            phone,
            phone_exact,
            phone_starts,
            phone_ends,
            date_from,
            date_to,
        )
        return query.all()
    company_ids = [
        link.company_id
        for link in db.query(CompanyUser).filter(CompanyUser.user_id == user.id, CompanyUser.is_active == True).all()
    ]
    if not company_ids:
        return []
    query = db.query(Company).filter(Company.id.in_(company_ids))
    query = apply_company_filters(
        query,
        search,
        tin,
        tin_exact,
        tin_starts,
        tin_ends,
        vat,
        vat_exact,
        vat_starts,
        vat_ends,
        email,
        email_exact,
        email_starts,
        email_ends,
        phone,
        phone_exact,
        phone_starts,
        phone_ends,
        date_from,
        date_to,
    )
    return query.all()


@router.get("/values")
def list_company_values(field: str, q: str | None = None, db: Session = Depends(get_db)):
    """Return distinct values for a given company field (e.g., 'name', 'tin')."""
    if field == "name":
        query = db.query(Company.name.distinct())
        if q:
            query = query.filter(Company.name.ilike(f"%{q}%"))
        return [r[0] for r in query.order_by(Company.name).all() if r[0]]
    if field == "tin":
        query = db.query(Company.tin.distinct())
        if q:
            query = query.filter(Company.tin.ilike(f"%{q}%"))
        return [r[0] for r in query.order_by(Company.tin).all() if r[0]]
    return []


@router.get("/{company_id}/portal-user")
def get_portal_user(company_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Get the portal user linked to a company."""
    link = db.query(CompanyUser).filter(
        CompanyUser.company_id == company_id,
        CompanyUser.role == "portal",
        CompanyUser.is_active == True,
    ).first()
    if not link:
        return {"user_id": None, "email": None}
    user = db.query(User).filter(User.id == link.user_id).first()
    if not user:
        return {"user_id": None, "email": None}
    return {"user_id": user.id, "email": user.email}


@router.patch("/{company_id}/portal-user")
def update_portal_user(
    company_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Update or create the portal user for a company."""
    from app.security.security import hash_password

    email = payload.get("email")
    password = payload.get("password")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Check if company exists
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Find existing portal link
    link = db.query(CompanyUser).filter(
        CompanyUser.company_id == company_id,
        CompanyUser.role == "portal",
    ).first()

    if link:
        # Update existing user
        user = db.query(User).filter(User.id == link.user_id).first()
        if user:
            user.email = email
            if password:
                user.hashed_password = hash_password(password)
        else:
            # Create new user and update link
            user = User(email=email, hashed_password=hash_password(password or "changeme"), is_admin=False)
            db.add(user)
            db.flush()
            link.user_id = user.id
    else:
        # Check if user with this email exists
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, hashed_password=hash_password(password or "changeme"), is_admin=False)
            db.add(user)
            db.flush()
        elif password:
            user.hashed_password = hash_password(password)
        # Create link
        db.add(CompanyUser(company_id=company_id, user_id=user.id, role="portal", is_active=True))

    db.commit()
    return {"user_id": user.id, "email": user.email}

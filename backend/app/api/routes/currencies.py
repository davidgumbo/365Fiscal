from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.api.deps import get_db, ensure_company_access, require_company_access, get_current_user
from app.models.currency import Currency, CurrencyRate
from app.schemas.currency import (
    CurrencyCreate, CurrencyUpdate, CurrencyRead, CurrencyReadBasic,
    CurrencyRateCreate, CurrencyRateUpdate, CurrencyRateRead,
)

router = APIRouter(prefix="/currencies", tags=["currencies"])


def ensure_currency_tables(db: Session) -> None:
    """Create currency tables when missing to avoid runtime UndefinedTable errors."""
    bind = db.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "currencies" not in existing_tables:
        Currency.__table__.create(bind=bind, checkfirst=True)
    if "currency_rates" not in existing_tables:
        CurrencyRate.__table__.create(bind=bind, checkfirst=True)


# ─── Currency CRUD ───

@router.get("", response_model=list[CurrencyReadBasic])
def list_currencies(
    company_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_company_access),
):
    """List all currencies for a company."""
    ensure_currency_tables(db)
    q = db.query(Currency).filter(Currency.company_id == company_id)
    if active_only:
        q = q.filter(Currency.is_active == True)
    return q.order_by(Currency.is_default.desc(), Currency.code).all()


@router.get("/{currency_id}", response_model=CurrencyRead)
def get_currency(
    currency_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get a single currency with its rates."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)
    return currency


@router.post("", response_model=CurrencyReadBasic, status_code=201)
def create_currency(
    payload: CurrencyCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new currency for a company."""
    ensure_currency_tables(db)
    ensure_company_access(db, user, payload.company_id)

    # Check for duplicate code
    existing = db.query(Currency).filter(
        Currency.company_id == payload.company_id,
        Currency.code == payload.code.upper(),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Currency {payload.code} already exists for this company")

    # If setting as default, unset other defaults
    if payload.is_default:
        db.query(Currency).filter(
            Currency.company_id == payload.company_id,
            Currency.is_default == True,
        ).update({"is_default": False})

    currency = Currency(
        company_id=payload.company_id,
        code=payload.code.upper(),
        name=payload.name,
        symbol=payload.symbol,
        position=payload.position,
        decimal_places=payload.decimal_places,
        is_default=payload.is_default,
        is_active=payload.is_active,
    )
    db.add(currency)
    db.commit()
    db.refresh(currency)

    # If this is the first currency for the company, make it default
    count = db.query(Currency).filter(Currency.company_id == payload.company_id).count()
    if count == 1:
        currency.is_default = True
        db.commit()
        db.refresh(currency)

    return currency


@router.patch("/{currency_id}", response_model=CurrencyReadBasic)
def update_currency(
    currency_id: int,
    payload: CurrencyUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a currency."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)

    updates = payload.dict(exclude_unset=True)

    # If setting as default, unset other defaults
    if updates.get("is_default"):
        db.query(Currency).filter(
            Currency.company_id == currency.company_id,
            Currency.is_default == True,
            Currency.id != currency_id,
        ).update({"is_default": False})

    # Uppercase the code if provided
    if "code" in updates and updates["code"]:
        updates["code"] = updates["code"].upper()

    for key, value in updates.items():
        setattr(currency, key, value)

    db.commit()
    db.refresh(currency)
    return currency


@router.delete("/{currency_id}")
def delete_currency(
    currency_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete a currency (and all its rates)."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)

    if currency.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default currency. Set another currency as default first.")

    db.delete(currency)
    db.commit()
    return {"detail": "Currency deleted"}


# ─── Currency Rate CRUD ───

@router.get("/{currency_id}/rates", response_model=list[CurrencyRateRead])
def list_rates(
    currency_id: int,
    limit: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List recent rates for a currency (most recent first)."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)

    rates = (
        db.query(CurrencyRate)
        .filter(CurrencyRate.currency_id == currency_id)
        .order_by(CurrencyRate.rate_date.desc())
        .limit(limit)
        .all()
    )
    return rates


@router.get("/{currency_id}/rate", response_model=CurrencyRateRead | None)
def get_rate_for_date(
    currency_id: int,
    for_date: date = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get the exchange rate for a specific date (or the most recent rate before that date)."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)

    target_date = for_date or date.today()

    # Get the rate for the exact date, or the most recent rate before it
    rate = (
        db.query(CurrencyRate)
        .filter(
            CurrencyRate.currency_id == currency_id,
            CurrencyRate.rate_date <= target_date,
        )
        .order_by(CurrencyRate.rate_date.desc())
        .first()
    )
    return rate


@router.post("/{currency_id}/rates", response_model=CurrencyRateRead, status_code=201)
def create_rate(
    currency_id: int,
    payload: CurrencyRateCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Set an exchange rate for a currency on a specific date."""
    ensure_currency_tables(db)
    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    ensure_company_access(db, user, currency.company_id)

    # Check if a rate already exists for this date — update instead
    existing = db.query(CurrencyRate).filter(
        CurrencyRate.currency_id == currency_id,
        CurrencyRate.rate_date == payload.rate_date,
    ).first()
    if existing:
        existing.rate = payload.rate
        db.commit()
        db.refresh(existing)
        return existing

    rate = CurrencyRate(
        currency_id=currency_id,
        company_id=currency.company_id,
        rate=payload.rate,
        rate_date=payload.rate_date,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.patch("/rates/{rate_id}", response_model=CurrencyRateRead)
def update_rate(
    rate_id: int,
    payload: CurrencyRateUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update an exchange rate."""
    ensure_currency_tables(db)
    rate = db.query(CurrencyRate).filter(CurrencyRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    ensure_company_access(db, user, rate.company_id)

    updates = payload.dict(exclude_unset=True)
    for key, value in updates.items():
        setattr(rate, key, value)

    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/rates/{rate_id}")
def delete_rate(
    rate_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete an exchange rate."""
    ensure_currency_tables(db)
    rate = db.query(CurrencyRate).filter(CurrencyRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    ensure_company_access(db, user, rate.company_id)

    db.delete(rate)
    db.commit()
    return {"detail": "Rate deleted"}

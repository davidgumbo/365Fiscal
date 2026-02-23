from datetime import date
from pydantic import BaseModel
from app.schemas.common import ORMBase


# --- Currency Schemas ---

class CurrencyCreate(BaseModel):
    company_id: int
    code: str
    name: str
    symbol: str
    position: str = "before"
    decimal_places: int = 2
    is_default: bool = False
    is_active: bool = True


class CurrencyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    symbol: str | None = None
    position: str | None = None
    decimal_places: int | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class CurrencyRateRead(ORMBase):
    id: int
    currency_id: int
    company_id: int
    rate: float
    rate_date: date


class CurrencyRead(ORMBase):
    id: int
    company_id: int
    code: str
    name: str
    symbol: str
    position: str
    decimal_places: int
    is_default: bool
    is_active: bool
    rates: list[CurrencyRateRead] = []


class CurrencyReadBasic(ORMBase):
    """Currency without rates - for listings."""
    id: int
    company_id: int
    code: str
    name: str
    symbol: str
    position: str
    decimal_places: int
    is_default: bool
    is_active: bool


# --- Currency Rate Schemas ---

class CurrencyRateCreate(BaseModel):
    currency_id: int
    company_id: int
    rate: float
    rate_date: date


class CurrencyRateUpdate(BaseModel):
    rate: float | None = None
    rate_date: date | None = None

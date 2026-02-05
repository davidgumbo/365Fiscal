from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBase


class QuotationLineCreate(BaseModel):
    product_id: int | None = None
    description: str = ""
    quantity: float = 1
    uom: str = ""
    unit_price: float = 0
    vat_rate: float = 0


class QuotationCreate(BaseModel):
    company_id: int
    customer_id: int
    expires_at: datetime | None = None
    payment_terms: str = ""
    lines: list[QuotationLineCreate] = []


class QuotationUpdate(BaseModel):
    customer_id: int | None = None
    expires_at: datetime | None = None
    payment_terms: str | None = None
    status: str | None = None
    lines: list[QuotationLineCreate] | None = None


class QuotationLineRead(ORMBase):
    id: int
    product_id: int | None = None
    description: str
    quantity: float
    uom: str
    unit_price: float
    vat_rate: float
    total_price: float


class QuotationRead(ORMBase):
    id: int
    company_id: int
    customer_id: int
    reference: str
    expires_at: datetime | None
    payment_terms: str
    status: str
    lines: list[QuotationLineRead]
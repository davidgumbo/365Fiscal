from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMBase


class ExpenseCreate(BaseModel):
    company_id: int
    vendor_id: int | None = None
    reference: str | None = None
    expense_date: datetime | None = None
    description: str = ""
    category: str = ""
    subtotal: float = 0
    vat_rate: float = 0
    currency: str = "USD"
    status: str = "posted"
    notes: str = ""


class ExpenseUpdate(BaseModel):
    vendor_id: int | None = None
    reference: str | None = None
    expense_date: datetime | None = None
    description: str | None = None
    category: str | None = None
    subtotal: float | None = None
    vat_rate: float | None = None
    currency: str | None = None
    status: str | None = None
    notes: str | None = None


class ExpenseRead(ORMBase):
    id: int
    company_id: int
    vendor_id: int | None
    reference: str
    expense_date: datetime
    description: str
    category: str
    subtotal: float
    vat_rate: float
    tax_amount: float
    total_amount: float
    currency: str
    status: str
    notes: str
    created_by_id: int | None = None
    created_at: datetime
    updated_at: datetime

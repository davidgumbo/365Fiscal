"""POS schemas for API serialization."""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

from app.schemas.common import ORMBase


# --- POS Order Line ---
class POSOrderLineCreate(BaseModel):
    product_id: int | None = None
    description: str = ""
    quantity: float = 1
    uom: str = "Units"
    unit_price: float = 0
    discount: float = 0
    vat_rate: float = 0


class POSOrderLineRead(ORMBase):
    id: int
    order_id: int
    product_id: int | None = None
    description: str
    quantity: float
    uom: str
    unit_price: float
    discount: float
    vat_rate: float
    subtotal: float
    tax_amount: float
    total_price: float


# --- POS Order ---
class POSOrderCreate(BaseModel):
    session_id: int
    company_id: int
    customer_id: int | None = None
    currency: str = "USD"
    payment_method: str = "cash"
    cash_amount: float = 0
    card_amount: float = 0
    mobile_amount: float = 0
    payment_reference: str = ""
    notes: str = ""
    lines: List[POSOrderLineCreate] = []
    auto_fiscalize: bool = False


class POSOrderRead(ORMBase):
    id: int
    session_id: int
    company_id: int
    invoice_id: int | None = None
    customer_id: int | None = None
    created_by_id: int
    reference: str
    status: str
    order_date: datetime
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    currency: str
    cash_amount: float
    card_amount: float
    mobile_amount: float
    change_amount: float
    payment_method: str
    payment_reference: str
    is_fiscalized: bool
    zimra_receipt_id: str
    zimra_verification_code: str
    zimra_verification_url: str
    fiscal_errors: str
    notes: str
    lines: List[POSOrderLineRead] = []


class POSOrderRefund(BaseModel):
    reason: str = ""


# --- POS Session ---
class POSSessionOpen(BaseModel):
    company_id: int
    device_id: int | None = None
    opening_balance: float = 0
    notes: str = ""


class POSSessionClose(BaseModel):
    closing_balance: float = 0
    notes: str = ""


class POSSessionRead(ORMBase):
    id: int
    company_id: int
    device_id: int | None = None
    opened_by_id: int
    closed_by_id: int | None = None
    name: str
    status: str
    opened_at: datetime
    closed_at: datetime | None = None
    opening_balance: float
    closing_balance: float | None = None
    total_sales: float
    total_returns: float
    total_cash: float
    total_card: float
    total_mobile: float
    transaction_count: int
    notes: str


class POSSessionSummary(BaseModel):
    session: POSSessionRead
    orders: List[POSOrderRead] = []
    expected_cash: float = 0
    difference: float = 0

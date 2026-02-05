from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBase
from app.schemas.invoice_line import InvoiceLineCreate, InvoiceLineRead


class InvoiceCreate(BaseModel):
    company_id: int
    quotation_id: int | None = None
    customer_id: int | None = None
    device_id: int | None = None
    reference: str | None = None
    invoice_date: datetime | None = None
    due_date: datetime | None = None
    currency: str = "USD"
    payment_terms: str = ""
    notes: str = ""
    lines: list[InvoiceLineCreate] = []


class InvoiceUpdate(BaseModel):
    quotation_id: int | None = None
    customer_id: int | None = None
    device_id: int | None = None
    reference: str | None = None
    invoice_date: datetime | None = None
    due_date: datetime | None = None
    status: str | None = None
    currency: str | None = None
    payment_terms: str | None = None
    payment_reference: str | None = None
    notes: str | None = None
    amount_paid: float | None = None
    lines: list[InvoiceLineCreate] | None = None


class InvoiceRead(ORMBase):
    id: int
    company_id: int
    quotation_id: int | None
    customer_id: int | None
    device_id: int | None
    reference: str
    status: str
    invoice_date: datetime | None
    due_date: datetime | None
    fiscalized_at: datetime | None
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    amount_paid: float
    amount_due: float
    currency: str
    payment_terms: str
    payment_reference: str
    notes: str
    zimra_status: str
    zimra_receipt_id: str
    zimra_receipt_counter: int
    zimra_receipt_global_no: int
    zimra_verification_code: str
    zimra_verification_url: str
    lines: list[InvoiceLineRead] = []

from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBase
from app.schemas.purchase_order_line import PurchaseOrderLineCreate, PurchaseOrderLineRead


class PurchaseOrderCreate(BaseModel):
    company_id: int
    vendor_id: int | None = None
    reference: str | None = None
    order_date: datetime | None = None
    expected_date: datetime | None = None
    currency: str = "USD"
    notes: str = ""
    warehouse_id: int | None = None
    location_id: int | None = None
    lines: list[PurchaseOrderLineCreate] = []


class PurchaseOrderUpdate(BaseModel):
    vendor_id: int | None = None
    reference: str | None = None
    status: str | None = None
    paid_state: str | None = None
    order_date: datetime | None = None
    expected_date: datetime | None = None
    currency: str | None = None
    notes: str | None = None
    warehouse_id: int | None = None
    location_id: int | None = None
    lines: list[PurchaseOrderLineCreate] | None = None


class PurchaseOrderRead(ORMBase):
    id: int
    company_id: int
    vendor_id: int | None
    reference: str
    status: str
    paid_state: str
    order_date: datetime | None
    expected_date: datetime | None
    received_at: datetime | None
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    currency: str
    notes: str
    warehouse_id: int | None
    location_id: int | None
    lines: list[PurchaseOrderLineRead] = []


class PurchaseOrderReceiveLine(BaseModel):
    id: int
    received_quantity: float


class PurchaseOrderReceive(BaseModel):
    lines: list[PurchaseOrderReceiveLine] = []

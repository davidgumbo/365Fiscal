from pydantic import BaseModel
from app.schemas.common import ORMBase


class PurchaseOrderLineCreate(BaseModel):
    product_id: int | None = None
    description: str = ""
    quantity: float = 1
    uom: str = ""
    unit_price: float = 0
    discount: float = 0
    vat_rate: float = 0


class PurchaseOrderLineRead(ORMBase):
    id: int
    purchase_order_id: int
    product_id: int | None
    description: str
    quantity: float
    uom: str
    unit_price: float
    discount: float
    vat_rate: float
    subtotal: float
    tax_amount: float
    total_price: float

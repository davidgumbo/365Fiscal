from pydantic import BaseModel
from app.schemas.common import ORMBase


class ProductCreate(BaseModel):
    company_id: int
    category_id: int | None = None
    name: str
    description: str = ""
    sale_price: float = 0
    tax_rate: float = 0
    sales_cost: float = 0
    purchase_cost: float = 0
    hs_code: str = ""
    reference: str = ""
    barcode: str = ""
    product_type: str = "storable"
    uom: str = "Units"
    track_inventory: bool = True
    min_stock_quantity: float = 0
    max_stock_quantity: float = 0
    reorder_point: float = 0
    weight: float = 0
    weight_uom: str = "kg"
    is_active: bool = True
    can_be_sold: bool = True
    can_be_purchased: bool = True


class ProductRead(ORMBase):
    id: int
    company_id: int
    category_id: int | None = None
    name: str
    description: str
    sale_price: float
    tax_rate: float
    sales_cost: float
    purchase_cost: float
    hs_code: str
    reference: str
    barcode: str
    product_type: str
    uom: str
    track_inventory: bool
    min_stock_quantity: float
    max_stock_quantity: float
    reorder_point: float
    weight: float
    weight_uom: str
    is_active: bool
    can_be_sold: bool
    can_be_purchased: bool


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    sale_price: float | None = None
    tax_rate: float | None = None
    sales_cost: float | None = None
    purchase_cost: float | None = None
    hs_code: str | None = None
    reference: str | None = None
    barcode: str | None = None
    product_type: str | None = None
    uom: str | None = None
    track_inventory: bool | None = None
    min_stock_quantity: float | None = None
    max_stock_quantity: float | None = None
    reorder_point: float | None = None
    weight: float | None = None
    weight_uom: str | None = None
    is_active: bool | None = None
    can_be_sold: bool | None = None
    can_be_purchased: bool | None = None


class ProductWithStock(ProductRead):
    """Product with computed stock quantities."""
    quantity_on_hand: float = 0
    quantity_available: float = 0
    quantity_reserved: float = 0
    stock_value: float = 0
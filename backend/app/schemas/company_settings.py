from pydantic import BaseModel
from app.schemas.common import ORMBase


class CompanySettingsCreate(BaseModel):
    company_id: int
    currency_code: str = "USD"
    currency_symbol: str = "$"
    currency_position: str = "before"
    decimal_places: int = 2
    invoice_prefix: str = "INV"
    quotation_prefix: str = "QUO"
    invoice_notes: str = ""
    payment_terms_default: str = "Due on receipt"
    inventory_valuation: str = "fifo"
    auto_reserve_stock: bool = True
    allow_negative_stock: bool = False
    fiscal_enabled: bool = False
    fiscal_device_id: int | None = None
    zimra_bp_no: str = ""
    zimra_tin: str = ""
    fiscal_auto_submit: bool = False
    default_sales_tax_id: int | None = None
    default_purchase_tax_id: int | None = None
    tax_included_in_price: bool = False


class CompanySettingsUpdate(BaseModel):
    currency_code: str | None = None
    currency_symbol: str | None = None
    currency_position: str | None = None
    decimal_places: int | None = None
    invoice_prefix: str | None = None
    quotation_prefix: str | None = None
    invoice_notes: str | None = None
    payment_terms_default: str | None = None
    inventory_valuation: str | None = None
    auto_reserve_stock: bool | None = None
    allow_negative_stock: bool | None = None
    fiscal_enabled: bool | None = None
    fiscal_device_id: int | None = None
    zimra_bp_no: str | None = None
    zimra_tin: str | None = None
    fiscal_auto_submit: bool | None = None
    default_sales_tax_id: int | None = None
    default_purchase_tax_id: int | None = None
    tax_included_in_price: bool | None = None


class CompanySettingsRead(ORMBase):
    id: int
    company_id: int
    currency_code: str
    currency_symbol: str
    currency_position: str
    decimal_places: int
    invoice_prefix: str
    quotation_prefix: str
    invoice_notes: str
    payment_terms_default: str
    inventory_valuation: str
    auto_reserve_stock: bool
    allow_negative_stock: bool
    fiscal_enabled: bool
    fiscal_device_id: int | None
    zimra_bp_no: str
    zimra_tin: str
    fiscal_auto_submit: bool
    default_sales_tax_id: int | None
    default_purchase_tax_id: int | None
    tax_included_in_price: bool

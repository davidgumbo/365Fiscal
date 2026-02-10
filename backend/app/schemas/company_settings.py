from pydantic import BaseModel
from app.schemas.common import ORMBase


class CompanySettingsCreate(BaseModel):
    company_id: int
    currency_code: str = "USD"
    currency_symbol: str = "$"
    currency_position: str = "before"
    decimal_places: int = 2
    logo_data: str = ""
    document_layout: str = "external_layout_standard"
    document_header: str = ""
    document_footer: str = ""
    document_watermark: str = ""
    document_watermark_opacity: str = "0.08"
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
    customer_account_enabled: bool = True
    customer_signup_mode: str = "invitation"
    password_reset_enabled: bool = True
    default_access_rights_enabled: bool = True
    api_keys_enabled: bool = False
    customer_api_keys_enabled: bool = False
    import_export_enabled: bool = True
    show_effect_enabled: bool = False
    push_notifications_enabled: bool = False
    disable_mobile_redirect: bool = False
    inter_company_transactions: bool = False


class CompanySettingsUpdate(BaseModel):
    currency_code: str | None = None
    currency_symbol: str | None = None
    currency_position: str | None = None
    decimal_places: int | None = None
    logo_data: str | None = None
    document_layout: str | None = None
    document_header: str | None = None
    document_footer: str | None = None
    document_watermark: str | None = None
    document_watermark_opacity: str | None = None
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
    customer_account_enabled: bool | None = None
    customer_signup_mode: str | None = None
    password_reset_enabled: bool | None = None
    default_access_rights_enabled: bool | None = None
    api_keys_enabled: bool | None = None
    customer_api_keys_enabled: bool | None = None
    import_export_enabled: bool | None = None
    show_effect_enabled: bool | None = None
    push_notifications_enabled: bool | None = None
    disable_mobile_redirect: bool | None = None
    inter_company_transactions: bool | None = None


class CompanySettingsRead(ORMBase):
    id: int
    company_id: int
    currency_code: str
    currency_symbol: str
    currency_position: str
    decimal_places: int
    logo_data: str
    document_layout: str
    document_header: str
    document_footer: str
    document_watermark: str
    document_watermark_opacity: str
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
    customer_account_enabled: bool
    customer_signup_mode: str
    password_reset_enabled: bool
    default_access_rights_enabled: bool
    api_keys_enabled: bool
    customer_api_keys_enabled: bool
    import_export_enabled: bool
    show_effect_enabled: bool
    push_notifications_enabled: bool
    disable_mobile_redirect: bool
    inter_company_transactions: bool

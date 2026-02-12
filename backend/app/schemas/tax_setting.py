from pydantic import BaseModel
from app.schemas.common import ORMBase


class TaxSettingCreate(BaseModel):
    company_id: int
    name: str = "VAT"
    description: str = ""
    tax_type: str = "sales"
    tax_scope: str = "sales"
    label_on_invoice: str = ""
    rate: float = 0
    zimra_code: str = ""
    is_active: bool = True
    zimra_tax_id: int | None = None
    zimra_tax_code: str = ""
    zimra_valid_from: str | None = None
    zimra_valid_till: str | None = None
    is_zimra_tax: bool = False


class TaxSettingUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tax_type: str | None = None
    tax_scope: str | None = None
    label_on_invoice: str | None = None
    rate: float | None = None
    zimra_code: str | None = None
    is_active: bool | None = None
    zimra_tax_id: int | None = None
    zimra_tax_code: str | None = None
    zimra_valid_from: str | None = None
    zimra_valid_till: str | None = None
    is_zimra_tax: bool | None = None


class TaxSettingRead(ORMBase):
    id: int
    company_id: int
    name: str
    description: str
    tax_type: str
    tax_scope: str
    label_on_invoice: str
    rate: float
    zimra_code: str
    is_active: bool
    zimra_tax_id: int | None = None
    zimra_tax_code: str = ""
    zimra_valid_from: str | None = None
    zimra_valid_till: str | None = None
    is_zimra_tax: bool = False

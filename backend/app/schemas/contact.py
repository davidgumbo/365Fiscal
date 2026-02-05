from pydantic import BaseModel, EmailStr
from app.schemas.common import ORMBase


class ContactCreate(BaseModel):
    company_id: int
    name: str
    address: str = ""
    vat: str = ""
    tin: str = ""
    phone: str = ""
    email: EmailStr | None = None
    reference: str = ""


class ContactRead(ORMBase):
    id: int
    company_id: int
    name: str
    address: str
    vat: str
    tin: str
    phone: str
    email: EmailStr | None = None
    reference: str


class ContactUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    vat: str | None = None
    tin: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    reference: str | None = None
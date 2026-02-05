from pydantic import BaseModel, EmailStr
from typing import Optional
from app.schemas.common import ORMBase


class CompanyCreate(BaseModel):
    name: str
    address: str = ""
    email: str | None = None
    phone: str = ""
    tin: str = ""
    vat: str = ""


class CompanyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    email: str | None = None
    phone: str | None = None
    tin: str | None = None
    vat: str | None = None


class CompanyRead(ORMBase):
    id: int
    name: str
    address: str
    email: str | None = None
    phone: str
    tin: str
    vat: str
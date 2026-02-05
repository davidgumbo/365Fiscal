from typing import Optional
from pydantic import BaseModel
from app.schemas.common import ORMBase


class WarehouseCreate(BaseModel):
    company_id: int
    name: str
    code: str = ""
    address: str = ""


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None


class WarehouseRead(ORMBase):
    id: int
    company_id: int
    name: str
    code: str
    address: str
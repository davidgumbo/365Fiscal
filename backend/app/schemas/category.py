from typing import Optional
from pydantic import BaseModel
from app.schemas.common import ORMBase


class CategoryCreate(BaseModel):
    company_id: int
    name: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None


class CategoryRead(ORMBase):
    id: int
    company_id: int
    name: str
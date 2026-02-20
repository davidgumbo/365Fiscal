from typing import Optional
from pydantic import BaseModel
from app.schemas.common import ORMBase


class ExpenseCategoryCreate(BaseModel):
    company_id: int
    name: str


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = None


class ExpenseCategoryRead(ORMBase):
    id: int
    company_id: int
    name: str

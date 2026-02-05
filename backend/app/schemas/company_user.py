from pydantic import BaseModel
from app.schemas.common import ORMBase


class CompanyUserCreate(BaseModel):
    company_id: int
    user_id: int
    role: str = "portal"


class CompanyUserRead(ORMBase):
    id: int
    company_id: int
    user_id: int
    role: str
    is_active: bool
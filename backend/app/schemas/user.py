from pydantic import BaseModel
from app.schemas.common import ORMBase


class UserCreate(BaseModel):
    email: str
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None


class UserRead(ORMBase):
    id: int
    email: str
    is_active: bool
    is_admin: bool

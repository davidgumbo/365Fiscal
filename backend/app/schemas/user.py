from pydantic import BaseModel
from app.schemas.common import ORMBase


class UserCreate(BaseModel):
    name: str = ""
    email: str
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None


class UserRead(ORMBase):
    id: int
    name: str
    email: str
    is_active: bool
    is_admin: bool

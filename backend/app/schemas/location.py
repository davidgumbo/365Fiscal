from typing import Optional
from pydantic import BaseModel
from app.schemas.common import ORMBase


class LocationCreate(BaseModel):
    warehouse_id: int
    name: str
    code: str = ""
    is_primary: bool = False


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_primary: Optional[bool] = None


class LocationRead(ORMBase):
    id: int
    warehouse_id: int
    name: str
    code: str
    is_primary: bool
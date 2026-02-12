from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBase


class DeviceCreate(BaseModel):
    company_id: int
    device_id: str = ""
    serial_number: str = ""
    model: str = ""
    activation_key: str = ""
    activation_date: datetime | None = None


class DeviceRead(ORMBase):
    id: int
    company_id: int
    device_id: str
    serial_number: str
    model: str
    activation_key: str
    activation_date: datetime | None
    crt_filename: str
    key_filename: str
    fiscal_day_status: str
    current_fiscal_day_no: int
    last_fiscal_day_no: int
    last_receipt_counter: int
    last_receipt_global_no: int

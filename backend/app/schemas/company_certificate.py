from pydantic import BaseModel
from app.schemas.common import ORMBase


class CompanyCertificateRead(ORMBase):
    id: int
    company_id: int
    crt_filename: str | None
    key_filename: str | None
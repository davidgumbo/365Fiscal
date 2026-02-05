from sqlalchemy import ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class CompanyCertificate(Base, TimestampMixin):
    __tablename__ = "company_certificates"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    crt_filename: Mapped[str] = mapped_column(String(255), default="")
    crt_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    key_filename: Mapped[str] = mapped_column(String(255), default="")
    key_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    company = relationship("Company", back_populates="certificates")

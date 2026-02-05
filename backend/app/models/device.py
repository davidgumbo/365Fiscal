from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Device(Base, TimestampMixin):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(100), default="")
    serial_number: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    activation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    crt_filename: Mapped[str] = mapped_column(String(255), default="")
    crt_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    key_filename: Mapped[str] = mapped_column(String(255), default="")
    key_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    fiscal_day_status: Mapped[str] = mapped_column(String(50), default="closed")
    current_fiscal_day_no: Mapped[int] = mapped_column(Integer, default=0)
    last_fiscal_day_no: Mapped[int] = mapped_column(Integer, default=0)
    last_receipt_counter: Mapped[int] = mapped_column(Integer, default=0)
    last_receipt_global_no: Mapped[int] = mapped_column(Integer, default=0)
    last_receipt_hash: Mapped[str] = mapped_column(String(512), default="")
    last_receipt_signature: Mapped[str] = mapped_column(String(2048), default="")
    qr_url: Mapped[str] = mapped_column(String(255), default="")

    company = relationship("Company", back_populates="devices")

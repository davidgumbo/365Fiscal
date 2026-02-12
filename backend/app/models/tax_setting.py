from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class TaxSetting(Base, TimestampMixin):
    __tablename__ = "tax_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), default="VAT")
    description: Mapped[str] = mapped_column(String(255), default="")
    tax_type: Mapped[str] = mapped_column(String(50), default="sales")
    tax_scope: Mapped[str] = mapped_column(String(50), default="sales")
    label_on_invoice: Mapped[str] = mapped_column(String(100), default="")
    rate: Mapped[float] = mapped_column(Float, default=0)
    zimra_code: Mapped[str] = mapped_column(String(50), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ZIMRA fields – populated by Pull from FDMS / GetConfig
    zimra_tax_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    zimra_tax_code: Mapped[str] = mapped_column(String(10), default="")
    zimra_valid_from: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
    zimra_valid_till: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
    is_zimra_tax: Mapped[bool] = mapped_column(Boolean, default=False)

    company = relationship("Company", back_populates="tax_settings")

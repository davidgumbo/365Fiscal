from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class CompanySettings(Base, TimestampMixin):
    """Company-specific settings for fiscal, inventory, and other configurations."""
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    
    # Currency settings
    currency_code: Mapped[str] = mapped_column(String(10), default="USD")
    currency_symbol: Mapped[str] = mapped_column(String(10), default="$")
    currency_position: Mapped[str] = mapped_column(String(10), default="before")  # before/after
    decimal_places: Mapped[int] = mapped_column(default=2)
    
    # Invoice settings
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV")
    quotation_prefix: Mapped[str] = mapped_column(String(20), default="QUO")
    invoice_notes: Mapped[str] = mapped_column(String(2000), default="")
    payment_terms_default: Mapped[str] = mapped_column(String(255), default="Due on receipt")
    
    # Inventory settings
    inventory_valuation: Mapped[str] = mapped_column(String(50), default="fifo")  # fifo, lifo, average
    auto_reserve_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_negative_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Fiscal settings
    fiscal_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    fiscal_device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    zimra_bp_no: Mapped[str] = mapped_column(String(50), default="")
    zimra_tin: Mapped[str] = mapped_column(String(50), default="")
    fiscal_auto_submit: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Tax settings
    default_sales_tax_id: Mapped[int | None] = mapped_column(ForeignKey("tax_settings.id"), nullable=True)
    default_purchase_tax_id: Mapped[int | None] = mapped_column(ForeignKey("tax_settings.id"), nullable=True)
    tax_included_in_price: Mapped[bool] = mapped_column(Boolean, default=False)

    company = relationship("Company", back_populates="settings")

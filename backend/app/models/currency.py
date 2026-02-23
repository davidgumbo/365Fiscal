from datetime import date
from sqlalchemy import Boolean, Date, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Currency(Base, TimestampMixin):
    """Currency definition for a company."""
    __tablename__ = "currencies"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_currency_company_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    code: Mapped[str] = mapped_column(String(10), index=True)  # e.g. USD, EUR, ZWG
    name: Mapped[str] = mapped_column(String(100))  # e.g. US Dollar
    symbol: Mapped[str] = mapped_column(String(10))  # e.g. $, €, ZWG
    position: Mapped[str] = mapped_column(String(10), default="before")  # before/after
    decimal_places: Mapped[int] = mapped_column(default=2)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    company = relationship("Company", backref="currencies")
    rates = relationship("CurrencyRate", back_populates="currency", cascade="all, delete-orphan", order_by="CurrencyRate.rate_date.desc()")


class CurrencyRate(Base, TimestampMixin):
    """Daily exchange rate for a currency relative to the company's default currency."""
    __tablename__ = "currency_rates"
    __table_args__ = (
        UniqueConstraint("currency_id", "rate_date", name="uq_currency_rate_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    currency_id: Mapped[int] = mapped_column(ForeignKey("currencies.id", ondelete="CASCADE"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    rate: Mapped[float] = mapped_column(Float, default=1.0)  # Rate relative to default currency
    rate_date: Mapped[date] = mapped_column(Date, index=True)

    # Relationships
    currency = relationship("Currency", back_populates="rates")
    company = relationship("Company")

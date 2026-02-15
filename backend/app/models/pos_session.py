"""POS Session model for tracking point-of-sale sessions."""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class POSSession(Base, TimestampMixin):
    """A POS session tracks opening/closing of a register."""
    __tablename__ = "pos_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    opened_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    closed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="open")  # open, closing, closed
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Cash management
    opening_balance: Mapped[float] = mapped_column(Float, default=0)
    closing_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_sales: Mapped[float] = mapped_column(Float, default=0)
    total_returns: Mapped[float] = mapped_column(Float, default=0)
    total_cash: Mapped[float] = mapped_column(Float, default=0)
    total_card: Mapped[float] = mapped_column(Float, default=0)
    total_mobile: Mapped[float] = mapped_column(Float, default=0)
    transaction_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")

    company = relationship("Company")
    device = relationship("Device")
    opened_by = relationship("User", foreign_keys=[opened_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    orders = relationship("POSOrder", back_populates="session", cascade="all, delete-orphan")


class POSOrder(Base, TimestampMixin):
    """Individual POS transaction / order."""
    __tablename__ = "pos_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("pos_sessions.id"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    reference: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft, paid, fiscalized, cancelled, refunded
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Amounts
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Payment split
    cash_amount: Mapped[float] = mapped_column(Float, default=0)
    card_amount: Mapped[float] = mapped_column(Float, default=0)
    mobile_amount: Mapped[float] = mapped_column(Float, default=0)
    change_amount: Mapped[float] = mapped_column(Float, default=0)
    payment_method: Mapped[str] = mapped_column(String(50), default="cash")
    payment_reference: Mapped[str] = mapped_column(String(255), default="")

    # Fiscalization
    is_fiscalized: Mapped[bool] = mapped_column(Boolean, default=False)
    zimra_receipt_id: Mapped[str] = mapped_column(String(100), default="")
    zimra_verification_code: Mapped[str] = mapped_column(String(50), default="")
    zimra_verification_url: Mapped[str] = mapped_column(String(255), default="")
    fiscal_errors: Mapped[str] = mapped_column(Text, default="")

    notes: Mapped[str] = mapped_column(Text, default="")

    session = relationship("POSSession", back_populates="orders")
    company = relationship("Company")
    invoice = relationship("Invoice")
    customer = relationship("Contact")
    created_by = relationship("User", foreign_keys=[created_by_id])
    lines = relationship("POSOrderLine", back_populates="order", cascade="all, delete-orphan")


class POSOrderLine(Base, TimestampMixin):
    """Line item within a POS order."""
    __tablename__ = "pos_order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("pos_orders.id"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)

    description: Mapped[str] = mapped_column(String(500), default="")
    quantity: Mapped[float] = mapped_column(Float, default=1)
    uom: Mapped[str] = mapped_column(String(50), default="Units")
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)  # percentage
    vat_rate: Mapped[float] = mapped_column(Float, default=0)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    total_price: Mapped[float] = mapped_column(Float, default=0)

    order = relationship("POSOrder", back_populates="lines")
    product = relationship("Product")

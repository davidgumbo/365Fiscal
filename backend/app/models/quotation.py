from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Quotation(Base, TimestampMixin):
    """Quotation model with enhanced workflow support."""
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"), index=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # Dates
    quotation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Financial
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    # Terms and notes
    payment_terms: Mapped[str] = mapped_column(String(255), default="")
    validity_days: Mapped[int] = mapped_column(default=30)
    notes: Mapped[str] = mapped_column(Text, default="")
    terms_conditions: Mapped[str] = mapped_column(Text, default="")
    
    # Status: draft, sent, accepted, rejected, converted, expired, cancelled
    status: Mapped[str] = mapped_column(String(50), default="draft")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # Locked after conversion
    
    # Linked invoice (after conversion)
    converted_invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    
    # Audit fields
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sent_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    company = relationship("Company", back_populates="quotations")
    customer = relationship("Contact")
    lines = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")
    converted_invoice = relationship("Invoice", foreign_keys=[converted_invoice_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    sent_by = relationship("User", foreign_keys=[sent_by_id])
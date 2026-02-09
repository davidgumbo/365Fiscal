from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    quotation_id: Mapped[int | None] = mapped_column(ForeignKey("quotations.id"), nullable=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    invoice_type: Mapped[str] = mapped_column(String(50), default="invoice")
    reversed_invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    invoice_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fiscalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Amount fields
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    amount_paid: Mapped[float] = mapped_column(Float, default=0)
    amount_due: Mapped[float] = mapped_column(Float, default=0)
    
    # Currency
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    # Payment info
    payment_terms: Mapped[str] = mapped_column(String(255), default="")
    payment_reference: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(String(2000), default="")
    
    # ZIMRA fiscalization fields
    zimra_status: Mapped[str] = mapped_column(String(50), default="not_submitted")
    zimra_receipt_id: Mapped[str] = mapped_column(String(100), default="")
    zimra_receipt_counter: Mapped[int] = mapped_column(default=0)
    zimra_receipt_global_no: Mapped[int] = mapped_column(default=0)
    zimra_device_signature: Mapped[str] = mapped_column(String(2048), default="")
    zimra_device_hash: Mapped[str] = mapped_column(String(512), default="")
    zimra_server_signature: Mapped[str] = mapped_column(String(2048), default="")
    zimra_server_hash: Mapped[str] = mapped_column(String(512), default="")
    zimra_verification_code: Mapped[str] = mapped_column(String(50), default="")
    zimra_verification_url: Mapped[str] = mapped_column(String(255), default="")
    zimra_payload: Mapped[str] = mapped_column(String(10000), default="")
    zimra_errors: Mapped[str] = mapped_column(String(2000), default="")

    company = relationship("Company", back_populates="invoices")
    quotation = relationship("Quotation")
    customer = relationship("Contact")
    device = relationship("Device")
    reversed_invoice = relationship("Invoice", remote_side=[id])
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")

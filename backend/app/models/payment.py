"""Payment model for tracking invoice payments and reconciliation."""
from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Payment(Base, TimestampMixin):
    """Payment records for invoices."""
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True, index=True)
    
    # Payment details
    reference: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    amount: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    # Payment method and source
    payment_method: Mapped[str] = mapped_column(String(50), default="cash")  # cash, bank_transfer, card, mobile_money, cheque
    payment_account: Mapped[str] = mapped_column(String(255), default="")  # Bank account, card reference, etc.
    transaction_reference: Mapped[str] = mapped_column(String(255), default="")  # External transaction ID
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="posted")  # draft, posted, reconciled, cancelled
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Notes
    notes: Mapped[str] = mapped_column(Text, default="")
    
    # Created by user
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    company = relationship("Company")
    invoice = relationship("Invoice", back_populates="payments")
    contact = relationship("Contact")
    created_by = relationship("User")


class PaymentMethod(Base, TimestampMixin):
    """Payment methods available for a company."""
    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(50))  # cash, bank_transfer, card, mobile_money, cheque
    is_active: Mapped[bool] = mapped_column(default=True)
    account_info: Mapped[str] = mapped_column(Text, default="")  # JSON for account details
    is_default: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)

    company = relationship("Company")

"""Audit log model for tracking all system actions."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class AuditLog(Base, TimestampMixin):
    """Comprehensive audit log for all system actions."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    # Actor information
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), default="")  # Denormalized for history
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255), default="")  # Denormalized for history
    
    # Action details
    action: Mapped[str] = mapped_column(String(100), index=True)  # e.g., create, update, delete, fiscalize
    resource_type: Mapped[str] = mapped_column(String(100), index=True)  # e.g., invoice, quotation, product
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    resource_reference: Mapped[str] = mapped_column(String(255), default="")  # e.g., invoice reference
    
    # Change tracking
    old_values: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    new_values: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    changes_summary: Mapped[str] = mapped_column(Text, default="")  # Human-readable summary
    
    # Request context
    ip_address: Mapped[str] = mapped_column(String(50), default="")
    user_agent: Mapped[str] = mapped_column(String(500), default="")
    request_id: Mapped[str] = mapped_column(String(100), default="")
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="success")  # success, failed, error
    error_message: Mapped[str] = mapped_column(Text, default="")
    
    # Timestamps
    action_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
    company = relationship("Company", foreign_keys=[company_id])


# Action constants
class AuditAction:
    # Authentication
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_RESET = "password_reset"
    
    # CRUD operations
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    
    # Invoice lifecycle
    INVOICE_CONFIRM = "invoice_confirm"
    INVOICE_CANCEL = "invoice_cancel"
    INVOICE_FISCALIZE = "invoice_fiscalize"
    INVOICE_FISCALIZE_RETRY = "invoice_fiscalize_retry"
    INVOICE_FISCALIZE_FAILED = "invoice_fiscalize_failed"
    
    # Quotation lifecycle
    QUOTATION_SEND = "quotation_send"
    QUOTATION_ACCEPT = "quotation_accept"
    QUOTATION_REJECT = "quotation_reject"
    QUOTATION_CONVERT = "quotation_convert"
    
    # Credit notes
    CREDIT_NOTE_CREATE = "credit_note_create"
    CREDIT_NOTE_CONFIRM = "credit_note_confirm"
    CREDIT_NOTE_FISCALIZE = "credit_note_fiscalize"
    
    # Payments
    PAYMENT_RECORD = "payment_record"
    PAYMENT_RECONCILE = "payment_reconcile"
    
    # Inventory
    STOCK_ADJUST = "stock_adjust"
    STOCK_MOVE = "stock_move"
    STOCK_RESERVE = "stock_reserve"
    STOCK_RELEASE = "stock_release"
    
    # Fiscal device
    FISCAL_DAY_OPEN = "fiscal_day_open"
    FISCAL_DAY_CLOSE = "fiscal_day_close"
    FISCAL_DEVICE_REGISTER = "fiscal_device_register"
    FISCAL_DEVICE_UPDATE = "fiscal_device_update"
    
    # Company & settings
    COMPANY_CREATE = "company_create"
    COMPANY_UPDATE = "company_update"
    SETTINGS_UPDATE = "settings_update"
    
    # User management
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_ROLE_CHANGE = "user_role_change"
    USER_DEACTIVATE = "user_deactivate"


# Resource type constants
class ResourceType:
    USER = "user"
    COMPANY = "company"
    COMPANY_USER = "company_user"
    PRODUCT = "product"
    CATEGORY = "category"
    WAREHOUSE = "warehouse"
    LOCATION = "location"
    CONTACT = "contact"
    QUOTATION = "quotation"
    INVOICE = "invoice"
    CREDIT_NOTE = "credit_note"
    PAYMENT = "payment"
    DEVICE = "device"
    TAX_SETTING = "tax_setting"
    CERTIFICATE = "certificate"
    STOCK_MOVE = "stock_move"
    STOCK_QUANT = "stock_quant"
    SETTINGS = "settings"

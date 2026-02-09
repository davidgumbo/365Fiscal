"""Role and Permission models for multi-company RBAC system."""
from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Role(Base, TimestampMixin):
    """System-wide role definitions with granular permissions."""
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False)  # Cannot be deleted
    level: Mapped[int] = mapped_column(default=0)  # Higher = more permissions

    # Permission flags - Company Management
    can_create_companies: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_companies: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_companies: Mapped[bool] = mapped_column(Boolean, default=False)
    can_view_all_companies: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - User Management
    can_create_users: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_users: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_users: Mapped[bool] = mapped_column(Boolean, default=False)
    can_assign_roles: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Product Management
    can_create_products: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_products: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_products: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Inventory & Warehouse
    can_manage_warehouses: Mapped[bool] = mapped_column(Boolean, default=False)
    can_view_inventory: Mapped[bool] = mapped_column(Boolean, default=True)
    can_adjust_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create_stock_moves: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Customers (Contacts)
    can_create_customers: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_customers: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_customers: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Quotations
    can_create_quotations: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_quotations: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_quotations: Mapped[bool] = mapped_column(Boolean, default=False)
    can_convert_quotations: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Invoices
    can_create_invoices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_invoices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete_invoices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_confirm_invoices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_cancel_invoices: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Credit Notes
    can_create_credit_notes: Mapped[bool] = mapped_column(Boolean, default=False)
    can_confirm_credit_notes: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Payments
    can_record_payments: Mapped[bool] = mapped_column(Boolean, default=False)
    can_reconcile_payments: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Fiscal Devices
    can_configure_fiscal_devices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_fiscalize_invoices: Mapped[bool] = mapped_column(Boolean, default=False)
    can_retry_fiscalization: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Settings & Configuration
    can_edit_company_settings: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_tax_settings: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_certificates: Mapped[bool] = mapped_column(Boolean, default=False)

    # Permission flags - Reports & Audit
    can_view_reports: Mapped[bool] = mapped_column(Boolean, default=True)
    can_view_fiscal_reports: Mapped[bool] = mapped_column(Boolean, default=False)
    can_export_reports: Mapped[bool] = mapped_column(Boolean, default=False)
    can_view_audit_logs: Mapped[bool] = mapped_column(Boolean, default=False)

    company_users = relationship("CompanyUser", back_populates="role_obj")


# Default system roles
SYSTEM_ROLES = [
    {
        "name": "system_admin",
        "display_name": "System Administrator",
        "description": "Full system access. Can create companies and manage all aspects.",
        "is_system_role": True,
        "level": 100,
        "can_create_companies": True,
        "can_edit_companies": True,
        "can_delete_companies": True,
        "can_view_all_companies": True,
        "can_create_users": True,
        "can_edit_users": True,
        "can_delete_users": True,
        "can_assign_roles": True,
        "can_create_products": True,
        "can_edit_products": True,
        "can_delete_products": True,
        "can_manage_warehouses": True,
        "can_view_inventory": True,
        "can_adjust_stock": True,
        "can_create_stock_moves": True,
        "can_create_customers": True,
        "can_edit_customers": True,
        "can_delete_customers": True,
        "can_create_quotations": True,
        "can_edit_quotations": True,
        "can_delete_quotations": True,
        "can_convert_quotations": True,
        "can_create_invoices": True,
        "can_edit_invoices": True,
        "can_delete_invoices": True,
        "can_confirm_invoices": True,
        "can_cancel_invoices": True,
        "can_create_credit_notes": True,
        "can_confirm_credit_notes": True,
        "can_record_payments": True,
        "can_reconcile_payments": True,
        "can_configure_fiscal_devices": True,
        "can_fiscalize_invoices": True,
        "can_retry_fiscalization": True,
        "can_edit_company_settings": True,
        "can_manage_tax_settings": True,
        "can_manage_certificates": True,
        "can_view_reports": True,
        "can_view_fiscal_reports": True,
        "can_export_reports": True,
        "can_view_audit_logs": True,
    },
    {
        "name": "company_admin",
        "display_name": "Company Administrator",
        "description": "Full access within assigned company. Can configure fiscal devices and manage users.",
        "is_system_role": True,
        "level": 80,
        "can_create_companies": False,
        "can_edit_companies": True,
        "can_delete_companies": False,
        "can_view_all_companies": False,
        "can_create_users": True,
        "can_edit_users": True,
        "can_delete_users": True,
        "can_assign_roles": True,
        "can_create_products": True,
        "can_edit_products": True,
        "can_delete_products": True,
        "can_manage_warehouses": True,
        "can_view_inventory": True,
        "can_adjust_stock": True,
        "can_create_stock_moves": True,
        "can_create_customers": True,
        "can_edit_customers": True,
        "can_delete_customers": True,
        "can_create_quotations": True,
        "can_edit_quotations": True,
        "can_delete_quotations": True,
        "can_convert_quotations": True,
        "can_create_invoices": True,
        "can_edit_invoices": True,
        "can_delete_invoices": True,
        "can_confirm_invoices": True,
        "can_cancel_invoices": True,
        "can_create_credit_notes": True,
        "can_confirm_credit_notes": True,
        "can_record_payments": True,
        "can_reconcile_payments": True,
        "can_configure_fiscal_devices": True,
        "can_fiscalize_invoices": True,
        "can_retry_fiscalization": True,
        "can_edit_company_settings": True,
        "can_manage_tax_settings": True,
        "can_manage_certificates": True,
        "can_view_reports": True,
        "can_view_fiscal_reports": True,
        "can_export_reports": True,
        "can_view_audit_logs": True,
    },
    {
        "name": "sales_user",
        "display_name": "Sales User",
        "description": "Can manage quotations, customers, and create invoices.",
        "is_system_role": True,
        "level": 40,
        "can_create_customers": True,
        "can_edit_customers": True,
        "can_create_quotations": True,
        "can_edit_quotations": True,
        "can_convert_quotations": True,
        "can_create_invoices": True,
        "can_edit_invoices": True,
        "can_view_inventory": True,
        "can_view_reports": True,
    },
    {
        "name": "accountant",
        "display_name": "Accountant",
        "description": "Can manage invoices, payments, and credit notes. Cannot edit company settings.",
        "is_system_role": True,
        "level": 50,
        "can_create_invoices": True,
        "can_edit_invoices": True,
        "can_confirm_invoices": True,
        "can_create_credit_notes": True,
        "can_confirm_credit_notes": True,
        "can_record_payments": True,
        "can_reconcile_payments": True,
        "can_view_inventory": True,
        "can_view_reports": True,
        "can_view_fiscal_reports": True,
        "can_export_reports": True,
    },
    {
        "name": "inventory_manager",
        "display_name": "Inventory Manager",
        "description": "Can manage products, inventory, and warehouses. Cannot modify invoices.",
        "is_system_role": True,
        "level": 45,
        "can_create_products": True,
        "can_edit_products": True,
        "can_delete_products": True,
        "can_manage_warehouses": True,
        "can_view_inventory": True,
        "can_adjust_stock": True,
        "can_create_stock_moves": True,
        "can_view_reports": True,
    },
    {
        "name": "read_only",
        "display_name": "Read-Only User",
        "description": "Can view all data but cannot make any changes.",
        "is_system_role": True,
        "level": 10,
        "can_view_inventory": True,
        "can_view_reports": True,
    },
]

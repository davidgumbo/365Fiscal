"""Role schemas for API."""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class RoleBase(BaseModel):
    name: str
    display_name: str = ""
    description: str = ""
    is_system_role: bool = False
    level: int = 0


class RolePermissions(BaseModel):
    # Company Management
    can_create_companies: bool = False
    can_edit_companies: bool = False
    can_delete_companies: bool = False
    can_view_all_companies: bool = False

    # User Management
    can_create_users: bool = False
    can_edit_users: bool = False
    can_delete_users: bool = False
    can_assign_roles: bool = False

    # Product Management
    can_create_products: bool = False
    can_edit_products: bool = False
    can_delete_products: bool = False

    # Inventory & Warehouse
    can_manage_warehouses: bool = False
    can_view_inventory: bool = True
    can_adjust_stock: bool = False
    can_create_stock_moves: bool = False

    # Customers
    can_create_customers: bool = False
    can_edit_customers: bool = False
    can_delete_customers: bool = False

    # Quotations
    can_create_quotations: bool = False
    can_edit_quotations: bool = False
    can_delete_quotations: bool = False
    can_convert_quotations: bool = False

    # Invoices
    can_create_invoices: bool = False
    can_edit_invoices: bool = False
    can_delete_invoices: bool = False
    can_confirm_invoices: bool = False
    can_cancel_invoices: bool = False

    # Credit Notes
    can_create_credit_notes: bool = False
    can_confirm_credit_notes: bool = False

    # Payments
    can_record_payments: bool = False
    can_reconcile_payments: bool = False

    # Fiscal Devices
    can_configure_fiscal_devices: bool = False
    can_fiscalize_invoices: bool = False
    can_retry_fiscalization: bool = False

    # Settings & Configuration
    can_edit_company_settings: bool = False
    can_manage_tax_settings: bool = False
    can_manage_certificates: bool = False

    # Reports & Audit
    can_view_reports: bool = True
    can_view_fiscal_reports: bool = False
    can_export_reports: bool = False
    can_view_audit_logs: bool = False


class RoleCreate(RoleBase, RolePermissions):
    pass


class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    # All permission fields are optional for update
    can_create_companies: Optional[bool] = None
    can_edit_companies: Optional[bool] = None
    can_delete_companies: Optional[bool] = None
    can_view_all_companies: Optional[bool] = None
    can_create_users: Optional[bool] = None
    can_edit_users: Optional[bool] = None
    can_delete_users: Optional[bool] = None
    can_assign_roles: Optional[bool] = None
    can_create_products: Optional[bool] = None
    can_edit_products: Optional[bool] = None
    can_delete_products: Optional[bool] = None
    can_manage_warehouses: Optional[bool] = None
    can_view_inventory: Optional[bool] = None
    can_adjust_stock: Optional[bool] = None
    can_create_stock_moves: Optional[bool] = None
    can_create_customers: Optional[bool] = None
    can_edit_customers: Optional[bool] = None
    can_delete_customers: Optional[bool] = None
    can_create_quotations: Optional[bool] = None
    can_edit_quotations: Optional[bool] = None
    can_delete_quotations: Optional[bool] = None
    can_convert_quotations: Optional[bool] = None
    can_create_invoices: Optional[bool] = None
    can_edit_invoices: Optional[bool] = None
    can_delete_invoices: Optional[bool] = None
    can_confirm_invoices: Optional[bool] = None
    can_cancel_invoices: Optional[bool] = None
    can_create_credit_notes: Optional[bool] = None
    can_confirm_credit_notes: Optional[bool] = None
    can_record_payments: Optional[bool] = None
    can_reconcile_payments: Optional[bool] = None
    can_configure_fiscal_devices: Optional[bool] = None
    can_fiscalize_invoices: Optional[bool] = None
    can_retry_fiscalization: Optional[bool] = None
    can_edit_company_settings: Optional[bool] = None
    can_manage_tax_settings: Optional[bool] = None
    can_manage_certificates: Optional[bool] = None
    can_view_reports: Optional[bool] = None
    can_view_fiscal_reports: Optional[bool] = None
    can_export_reports: Optional[bool] = None
    can_view_audit_logs: Optional[bool] = None


class RoleRead(RoleBase, RolePermissions):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

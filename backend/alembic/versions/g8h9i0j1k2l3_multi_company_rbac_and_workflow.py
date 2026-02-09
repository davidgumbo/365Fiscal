"""multi_company_rbac_and_workflow

Revision ID: g8h9i0j1k2l3
Revises: f7c9d2a1b3c4
Create Date: 2026-02-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g8h9i0j1k2l3'
down_revision = 'f7c9d2a1b3c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('display_name', sa.String(255), server_default=''),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('is_system_role', sa.Boolean(), server_default='false'),
        sa.Column('level', sa.Integer(), server_default='0'),
        # Company Management
        sa.Column('can_create_companies', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_companies', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_companies', sa.Boolean(), server_default='false'),
        sa.Column('can_view_all_companies', sa.Boolean(), server_default='false'),
        # User Management
        sa.Column('can_create_users', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_users', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_users', sa.Boolean(), server_default='false'),
        sa.Column('can_assign_roles', sa.Boolean(), server_default='false'),
        # Product Management
        sa.Column('can_create_products', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_products', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_products', sa.Boolean(), server_default='false'),
        # Inventory & Warehouse
        sa.Column('can_manage_warehouses', sa.Boolean(), server_default='false'),
        sa.Column('can_view_inventory', sa.Boolean(), server_default='true'),
        sa.Column('can_adjust_stock', sa.Boolean(), server_default='false'),
        sa.Column('can_create_stock_moves', sa.Boolean(), server_default='false'),
        # Customers
        sa.Column('can_create_customers', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_customers', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_customers', sa.Boolean(), server_default='false'),
        # Quotations
        sa.Column('can_create_quotations', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_quotations', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_quotations', sa.Boolean(), server_default='false'),
        sa.Column('can_convert_quotations', sa.Boolean(), server_default='false'),
        # Invoices
        sa.Column('can_create_invoices', sa.Boolean(), server_default='false'),
        sa.Column('can_edit_invoices', sa.Boolean(), server_default='false'),
        sa.Column('can_delete_invoices', sa.Boolean(), server_default='false'),
        sa.Column('can_confirm_invoices', sa.Boolean(), server_default='false'),
        sa.Column('can_cancel_invoices', sa.Boolean(), server_default='false'),
        # Credit Notes
        sa.Column('can_create_credit_notes', sa.Boolean(), server_default='false'),
        sa.Column('can_confirm_credit_notes', sa.Boolean(), server_default='false'),
        # Payments
        sa.Column('can_record_payments', sa.Boolean(), server_default='false'),
        sa.Column('can_reconcile_payments', sa.Boolean(), server_default='false'),
        # Fiscal Devices
        sa.Column('can_configure_fiscal_devices', sa.Boolean(), server_default='false'),
        sa.Column('can_fiscalize_invoices', sa.Boolean(), server_default='false'),
        sa.Column('can_retry_fiscalization', sa.Boolean(), server_default='false'),
        # Settings & Configuration
        sa.Column('can_edit_company_settings', sa.Boolean(), server_default='false'),
        sa.Column('can_manage_tax_settings', sa.Boolean(), server_default='false'),
        sa.Column('can_manage_certificates', sa.Boolean(), server_default='false'),
        # Reports & Audit
        sa.Column('can_view_reports', sa.Boolean(), server_default='true'),
        sa.Column('can_view_fiscal_reports', sa.Boolean(), server_default='false'),
        sa.Column('can_export_reports', sa.Boolean(), server_default='false'),
        sa.Column('can_view_audit_logs', sa.Boolean(), server_default='false'),
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_roles_name', 'roles', ['name'], unique=True)

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_email', sa.String(255), server_default=''),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('company_name', sa.String(255), server_default=''),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('resource_reference', sa.String(255), server_default=''),
        sa.Column('old_values', sa.Text(), server_default='{}'),
        sa.Column('new_values', sa.Text(), server_default='{}'),
        sa.Column('changes_summary', sa.Text(), server_default=''),
        sa.Column('ip_address', sa.String(50), server_default=''),
        sa.Column('user_agent', sa.String(500), server_default=''),
        sa.Column('request_id', sa.String(100), server_default=''),
        sa.Column('status', sa.String(50), server_default='success'),
        sa.Column('error_message', sa.Text(), server_default=''),
        sa.Column('action_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_company_id', 'audit_logs', ['company_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_resource_id', 'audit_logs', ['resource_id'])
    op.create_index('ix_audit_logs_action_at', 'audit_logs', ['action_at'])

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=True),
        sa.Column('contact_id', sa.Integer(), nullable=True),
        sa.Column('reference', sa.String(100), nullable=False),
        sa.Column('payment_date', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('amount', sa.Float(), server_default='0'),
        sa.Column('currency', sa.String(10), server_default='USD'),
        sa.Column('payment_method', sa.String(50), server_default='cash'),
        sa.Column('payment_account', sa.String(255), server_default=''),
        sa.Column('transaction_reference', sa.String(255), server_default=''),
        sa.Column('status', sa.String(50), server_default='posted'),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), server_default=''),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id']),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payments_reference', 'payments', ['reference'], unique=True)
    op.create_index('ix_payments_company_id', 'payments', ['company_id'])
    op.create_index('ix_payments_invoice_id', 'payments', ['invoice_id'])

    # Create payment_methods table
    op.create_table(
        'payment_methods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('account_info', sa.Text(), server_default=''),
        sa.Column('is_default', sa.Boolean(), server_default='false'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payment_methods_company_id', 'payment_methods', ['company_id'])

    # Add new columns to company_users
    op.add_column('company_users', sa.Column('role_id', sa.Integer(), nullable=True))
    op.add_column('company_users', sa.Column('is_company_admin', sa.Boolean(), server_default='false'))
    op.create_foreign_key('fk_company_users_role_id', 'company_users', 'roles', ['role_id'], ['id'])
    op.create_index('ix_company_users_role_id', 'company_users', ['role_id'])

    # Add new columns to invoices
    op.add_column('invoices', sa.Column('created_by_id', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('confirmed_by_id', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('fiscalized_by_id', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('cancelled_by_id', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('stock_processed', sa.Boolean(), server_default='false'))
    op.add_column('invoices', sa.Column('warehouse_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_invoices_created_by_id', 'invoices', 'users', ['created_by_id'], ['id'])
    op.create_foreign_key('fk_invoices_confirmed_by_id', 'invoices', 'users', ['confirmed_by_id'], ['id'])
    op.create_foreign_key('fk_invoices_fiscalized_by_id', 'invoices', 'users', ['fiscalized_by_id'], ['id'])
    op.create_foreign_key('fk_invoices_cancelled_by_id', 'invoices', 'users', ['cancelled_by_id'], ['id'])
    op.create_foreign_key('fk_invoices_warehouse_id', 'invoices', 'warehouses', ['warehouse_id'], ['id'])

    # Add new columns to quotations
    op.add_column('quotations', sa.Column('quotation_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quotations', sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quotations', sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quotations', sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quotations', sa.Column('converted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('quotations', sa.Column('subtotal', sa.Float(), server_default='0'))
    op.add_column('quotations', sa.Column('discount_amount', sa.Float(), server_default='0'))
    op.add_column('quotations', sa.Column('tax_amount', sa.Float(), server_default='0'))
    op.add_column('quotations', sa.Column('total_amount', sa.Float(), server_default='0'))
    op.add_column('quotations', sa.Column('currency', sa.String(10), server_default='USD'))
    op.add_column('quotations', sa.Column('validity_days', sa.Integer(), server_default='30'))
    op.add_column('quotations', sa.Column('notes', sa.Text(), server_default=''))
    op.add_column('quotations', sa.Column('terms_conditions', sa.Text(), server_default=''))
    op.add_column('quotations', sa.Column('is_locked', sa.Boolean(), server_default='false'))
    op.add_column('quotations', sa.Column('converted_invoice_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('created_by_id', sa.Integer(), nullable=True))
    op.add_column('quotations', sa.Column('sent_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_quotations_converted_invoice_id', 'quotations', 'invoices', ['converted_invoice_id'], ['id'])
    op.create_foreign_key('fk_quotations_created_by_id', 'quotations', 'users', ['created_by_id'], ['id'])
    op.create_foreign_key('fk_quotations_sent_by_id', 'quotations', 'users', ['sent_by_id'], ['id'])


def downgrade() -> None:
    # Drop quotation columns
    op.drop_constraint('fk_quotations_sent_by_id', 'quotations', type_='foreignkey')
    op.drop_constraint('fk_quotations_created_by_id', 'quotations', type_='foreignkey')
    op.drop_constraint('fk_quotations_converted_invoice_id', 'quotations', type_='foreignkey')
    op.drop_column('quotations', 'sent_by_id')
    op.drop_column('quotations', 'created_by_id')
    op.drop_column('quotations', 'converted_invoice_id')
    op.drop_column('quotations', 'is_locked')
    op.drop_column('quotations', 'terms_conditions')
    op.drop_column('quotations', 'notes')
    op.drop_column('quotations', 'validity_days')
    op.drop_column('quotations', 'currency')
    op.drop_column('quotations', 'total_amount')
    op.drop_column('quotations', 'tax_amount')
    op.drop_column('quotations', 'discount_amount')
    op.drop_column('quotations', 'subtotal')
    op.drop_column('quotations', 'converted_at')
    op.drop_column('quotations', 'rejected_at')
    op.drop_column('quotations', 'accepted_at')
    op.drop_column('quotations', 'sent_at')
    op.drop_column('quotations', 'quotation_date')

    # Drop invoice columns
    op.drop_constraint('fk_invoices_warehouse_id', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_invoices_cancelled_by_id', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_invoices_fiscalized_by_id', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_invoices_confirmed_by_id', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_invoices_created_by_id', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'warehouse_id')
    op.drop_column('invoices', 'stock_processed')
    op.drop_column('invoices', 'cancelled_by_id')
    op.drop_column('invoices', 'fiscalized_by_id')
    op.drop_column('invoices', 'confirmed_by_id')
    op.drop_column('invoices', 'created_by_id')

    # Drop company_users columns
    op.drop_index('ix_company_users_role_id', 'company_users')
    op.drop_constraint('fk_company_users_role_id', 'company_users', type_='foreignkey')
    op.drop_column('company_users', 'is_company_admin')
    op.drop_column('company_users', 'role_id')

    # Drop payment_methods table
    op.drop_index('ix_payment_methods_company_id', 'payment_methods')
    op.drop_table('payment_methods')

    # Drop payments table
    op.drop_index('ix_payments_invoice_id', 'payments')
    op.drop_index('ix_payments_company_id', 'payments')
    op.drop_index('ix_payments_reference', 'payments')
    op.drop_table('payments')

    # Drop audit_logs table
    op.drop_index('ix_audit_logs_action_at', 'audit_logs')
    op.drop_index('ix_audit_logs_resource_id', 'audit_logs')
    op.drop_index('ix_audit_logs_resource_type', 'audit_logs')
    op.drop_index('ix_audit_logs_action', 'audit_logs')
    op.drop_index('ix_audit_logs_company_id', 'audit_logs')
    op.drop_index('ix_audit_logs_user_id', 'audit_logs')
    op.drop_table('audit_logs')

    # Drop roles table
    op.drop_index('ix_roles_name', 'roles')
    op.drop_table('roles')

"""Add invoice lines, stock management, and company settings

Revision ID: a8f3b2c1d4e5
Revises: dd344aba7187
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8f3b2c1d4e5'
down_revision = 'dd344aba7187'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to invoices table
    op.add_column('invoices', sa.Column('customer_id', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('invoice_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('amount_paid', sa.Float(), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('amount_due', sa.Float(), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('currency', sa.String(10), nullable=False, server_default='USD'))
    op.add_column('invoices', sa.Column('payment_terms', sa.String(255), nullable=False, server_default=''))
    op.add_column('invoices', sa.Column('payment_reference', sa.String(100), nullable=False, server_default=''))
    op.add_column('invoices', sa.Column('notes', sa.String(2000), nullable=False, server_default=''))
    op.create_foreign_key('fk_invoices_customer_id', 'invoices', 'contacts', ['customer_id'], ['id'])
    
    # Add new columns to products table
    op.add_column('products', sa.Column('product_type', sa.String(50), nullable=False, server_default='storable'))
    op.add_column('products', sa.Column('uom', sa.String(50), nullable=False, server_default='PCS'))
    op.add_column('products', sa.Column('track_inventory', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('products', sa.Column('min_stock_quantity', sa.Float(), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('max_stock_quantity', sa.Float(), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('reorder_point', sa.Float(), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('weight', sa.Float(), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('weight_uom', sa.String(20), nullable=False, server_default='kg'))
    op.add_column('products', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('products', sa.Column('can_be_sold', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('products', sa.Column('can_be_purchased', sa.Boolean(), nullable=False, server_default='true'))
    
    # Create invoice_lines table
    op.create_table(
        'invoice_lines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(1000), nullable=False, server_default=''),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='1'),
        sa.Column('uom', sa.String(50), nullable=False, server_default=''),
        sa.Column('unit_price', sa.Float(), nullable=False, server_default='0'),
        sa.Column('discount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('vat_rate', sa.Float(), nullable=False, server_default='0'),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_price', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
    )
    op.create_index('ix_invoice_lines_invoice_id', 'invoice_lines', ['invoice_id'])
    
    # Create stock_moves table
    op.create_table(
        'stock_moves',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('reference', sa.String(100), nullable=False, server_default=''),
        sa.Column('move_type', sa.String(50), nullable=False, server_default='in'),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unit_cost', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_cost', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source_document', sa.String(100), nullable=False, server_default=''),
        sa.Column('state', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('scheduled_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('done_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.String(1000), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
    )
    op.create_index('ix_stock_moves_company_id', 'stock_moves', ['company_id'])
    op.create_index('ix_stock_moves_product_id', 'stock_moves', ['product_id'])
    
    # Create stock_quants table
    op.create_table(
        'stock_quants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('lot_number', sa.String(100), nullable=False, server_default=''),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('reserved_quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('available_quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unit_cost', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_value', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
        sa.UniqueConstraint('product_id', 'location_id', name='uq_product_location'),
    )
    op.create_index('ix_stock_quants_company_id', 'stock_quants', ['company_id'])
    op.create_index('ix_stock_quants_product_id', 'stock_quants', ['product_id'])
    
    # Create company_settings table
    op.create_table(
        'company_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('currency_code', sa.String(10), nullable=False, server_default='USD'),
        sa.Column('currency_symbol', sa.String(10), nullable=False, server_default='$'),
        sa.Column('currency_position', sa.String(10), nullable=False, server_default='before'),
        sa.Column('decimal_places', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('invoice_prefix', sa.String(20), nullable=False, server_default='INV'),
        sa.Column('quotation_prefix', sa.String(20), nullable=False, server_default='QUO'),
        sa.Column('invoice_notes', sa.String(2000), nullable=False, server_default=''),
        sa.Column('payment_terms_default', sa.String(255), nullable=False, server_default='Due on receipt'),
        sa.Column('inventory_valuation', sa.String(50), nullable=False, server_default='fifo'),
        sa.Column('auto_reserve_stock', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('allow_negative_stock', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fiscal_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fiscal_device_id', sa.Integer(), nullable=True),
        sa.Column('zimra_bp_no', sa.String(50), nullable=False, server_default=''),
        sa.Column('zimra_tin', sa.String(50), nullable=False, server_default=''),
        sa.Column('fiscal_auto_submit', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('default_sales_tax_id', sa.Integer(), nullable=True),
        sa.Column('default_purchase_tax_id', sa.Integer(), nullable=True),
        sa.Column('tax_included_in_price', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['fiscal_device_id'], ['devices.id']),
        sa.ForeignKeyConstraint(['default_sales_tax_id'], ['tax_settings.id']),
        sa.ForeignKeyConstraint(['default_purchase_tax_id'], ['tax_settings.id']),
    )
    op.create_index('ix_company_settings_company_id', 'company_settings', ['company_id'], unique=True)


def downgrade() -> None:
    op.drop_table('company_settings')
    op.drop_table('stock_quants')
    op.drop_table('stock_moves')
    op.drop_table('invoice_lines')
    
    # Remove product columns
    op.drop_column('products', 'can_be_purchased')
    op.drop_column('products', 'can_be_sold')
    op.drop_column('products', 'is_active')
    op.drop_column('products', 'weight_uom')
    op.drop_column('products', 'weight')
    op.drop_column('products', 'reorder_point')
    op.drop_column('products', 'max_stock_quantity')
    op.drop_column('products', 'min_stock_quantity')
    op.drop_column('products', 'track_inventory')
    op.drop_column('products', 'uom')
    op.drop_column('products', 'product_type')
    
    # Remove invoice columns
    op.drop_constraint('fk_invoices_customer_id', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'notes')
    op.drop_column('invoices', 'payment_reference')
    op.drop_column('invoices', 'payment_terms')
    op.drop_column('invoices', 'currency')
    op.drop_column('invoices', 'amount_due')
    op.drop_column('invoices', 'amount_paid')
    op.drop_column('invoices', 'tax_amount')
    op.drop_column('invoices', 'discount_amount')
    op.drop_column('invoices', 'subtotal')
    op.drop_column('invoices', 'due_date')
    op.drop_column('invoices', 'invoice_date')
    op.drop_column('invoices', 'customer_id')

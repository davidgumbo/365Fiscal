"""pos_sessions_orders_tables

Revision ID: p1o2s3t4a5b6
Revises: m1n2o3p4q5r6
Create Date: 2026-02-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'p1o2s3t4a5b6'
down_revision = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pos_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False, index=True),
        sa.Column('device_id', sa.Integer(), sa.ForeignKey('devices.id'), nullable=True),
        sa.Column('opened_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('closed_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='open'),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opening_balance', sa.Float(), nullable=False, server_default='0'),
        sa.Column('closing_balance', sa.Float(), nullable=True),
        sa.Column('total_sales', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_returns', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_cash', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_card', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_mobile', sa.Float(), nullable=False, server_default='0'),
        sa.Column('transaction_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'pos_orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('pos_sessions.id'), nullable=False, index=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False, index=True),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('contacts.id'), nullable=True),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reference', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='draft'),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='USD'),
        sa.Column('cash_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('card_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('mobile_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('change_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('payment_method', sa.String(50), nullable=False, server_default='cash'),
        sa.Column('payment_reference', sa.String(255), nullable=False, server_default=''),
        sa.Column('is_fiscalized', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('zimra_receipt_id', sa.String(100), nullable=False, server_default=''),
        sa.Column('zimra_verification_code', sa.String(50), nullable=False, server_default=''),
        sa.Column('zimra_verification_url', sa.String(255), nullable=False, server_default=''),
        sa.Column('fiscal_errors', sa.Text(), nullable=False, server_default=''),
        sa.Column('notes', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'pos_order_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('pos_orders.id'), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=True),
        sa.Column('description', sa.String(500), nullable=False, server_default=''),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='1'),
        sa.Column('uom', sa.String(50), nullable=False, server_default='Units'),
        sa.Column('unit_price', sa.Float(), nullable=False, server_default='0'),
        sa.Column('discount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('vat_rate', sa.Float(), nullable=False, server_default='0'),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_price', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('pos_order_lines')
    op.drop_table('pos_orders')
    op.drop_table('pos_sessions')

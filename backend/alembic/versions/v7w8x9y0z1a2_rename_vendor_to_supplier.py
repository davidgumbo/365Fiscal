"""rename vendor_id to supplier_id

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-02-23 00:00:00.000000
"""

from alembic import op

revision = "v7w8x9y0z1a2"
down_revision = "u6v7w8x9y0z1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Purchase orders: rename vendor_id -> supplier_id
    op.drop_index("ix_purchase_orders_vendor_id", table_name="purchase_orders")
    op.alter_column("purchase_orders", "vendor_id", new_column_name="supplier_id")
    op.create_index("ix_purchase_orders_supplier_id", "purchase_orders", ["supplier_id"])

    # Expenses: rename vendor_id -> supplier_id
    op.drop_index("ix_expenses_vendor_id", table_name="expenses")
    op.alter_column("expenses", "vendor_id", new_column_name="supplier_id")
    op.create_index("ix_expenses_supplier_id", "expenses", ["supplier_id"])


def downgrade() -> None:
    # Expenses: rename supplier_id -> vendor_id
    op.drop_index("ix_expenses_supplier_id", table_name="expenses")
    op.alter_column("expenses", "supplier_id", new_column_name="vendor_id")
    op.create_index("ix_expenses_vendor_id", "expenses", ["vendor_id"])

    # Purchase orders: rename supplier_id -> vendor_id
    op.drop_index("ix_purchase_orders_supplier_id", table_name="purchase_orders")
    op.alter_column("purchase_orders", "supplier_id", new_column_name="vendor_id")
    op.create_index("ix_purchase_orders_vendor_id", "purchase_orders", ["vendor_id"])

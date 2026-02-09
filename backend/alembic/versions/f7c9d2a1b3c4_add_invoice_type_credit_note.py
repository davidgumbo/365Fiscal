"""add invoice type and credit note linkage

Revision ID: f7c9d2a1b3c4
Revises: f2a1c9b8d0a1
Create Date: 2026-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "f7c9d2a1b3c4"
down_revision = "f2a1c9b8d0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("invoice_type", sa.String(length=50), nullable=False, server_default="invoice"))
    op.add_column("invoices", sa.Column("reversed_invoice_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_invoices_reversed_invoice_id",
        "invoices",
        "invoices",
        ["reversed_invoice_id"],
        ["id"],
    )
    op.create_index("ix_invoices_reversed_invoice_id", "invoices", ["reversed_invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_invoices_reversed_invoice_id", table_name="invoices")
    op.drop_constraint("fk_invoices_reversed_invoice_id", "invoices", type_="foreignkey")
    op.drop_column("invoices", "reversed_invoice_id")
    op.drop_column("invoices", "invoice_type")

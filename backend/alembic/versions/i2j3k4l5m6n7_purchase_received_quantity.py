"""purchase_received_quantity

Revision ID: i2j3k4l5m6n7
Revises: h1a2b3c4d5e6
Create Date: 2026-02-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "i2j3k4l5m6n7"
down_revision = "h1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_order_lines",
        sa.Column("received_quantity", sa.Float(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("purchase_order_lines", "received_quantity")

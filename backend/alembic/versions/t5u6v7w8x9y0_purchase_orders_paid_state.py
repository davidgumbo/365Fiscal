"""purchase orders paid_state

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-02-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "t5u6v7w8x9y0"
down_revision = "s4t5u6v7w8x9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "purchase_orders",
        sa.Column(
            "paid_state",
            sa.String(length=20),
            server_default="unpaid",
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("purchase_orders", "paid_state")

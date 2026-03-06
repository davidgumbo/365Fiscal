"""add product show_in_pos flag

Revision ID: n7o8p9q0r1s2
Revises: merge_aa9b8_w8x9
Create Date: 2026-03-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "n7o8p9q0r1s2"
down_revision = "merge_aa9b8_w8x9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "show_in_pos" not in columns:
        op.add_column(
            "products",
            sa.Column("show_in_pos", sa.Boolean(), nullable=False, server_default=sa.true()),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "show_in_pos" in columns:
        op.drop_column("products", "show_in_pos")

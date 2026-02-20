"""add product image_url

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "s4t5u6v7w8x9"
down_revision = "r3s4t5u6v7w8"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "image_url" not in columns:
        op.add_column(
            "products",
            sa.Column("image_url", sa.Text(), server_default="", nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "image_url" in columns:
        op.drop_column("products", "image_url")

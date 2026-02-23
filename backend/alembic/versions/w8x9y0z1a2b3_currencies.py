"""create currencies and currency_rates tables

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-02-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "w8x9y0z1a2b3"
down_revision = "v7w8x9y0z1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    existing = inspector.get_table_names()

    if "currencies" not in existing:
        op.create_table(
            "currencies",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("code", sa.String(10), nullable=False, index=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("symbol", sa.String(10), nullable=False),
            sa.Column("position", sa.String(10), nullable=False, server_default="before"),
            sa.Column("decimal_places", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("company_id", "code", name="uq_currency_company_code"),
        )

    if "currency_rates" not in existing:
        op.create_table(
            "currency_rates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("currency_id", sa.Integer(), sa.ForeignKey("currencies.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("rate", sa.Float(), nullable=False, server_default="1.0"),
            sa.Column("rate_date", sa.Date(), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("currency_id", "rate_date", name="uq_currency_rate_date"),
        )


def downgrade() -> None:
    op.drop_table("currency_rates")
    op.drop_table("currencies")

"""add subscriptions and activation_codes tables

Revision ID: m1n2o3p4q5r6
Revises: d4e5f6a7b8c9, k4l5m6n7o8p9
Create Date: 2026-02-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, Sequence[str]] = ("d4e5f6a7b8c9", "k4l5m6n7o8p9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), unique=True, index=True, nullable=False),
        sa.Column("plan", sa.String(50), server_default="trial", nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_users", sa.Integer(), server_default="5", nullable=False),
        sa.Column("max_devices", sa.Integer(), server_default="2", nullable=False),
        sa.Column("max_invoices_per_month", sa.Integer(), server_default="100", nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )

    op.create_table(
        "activation_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, index=True, nullable=False),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), index=True, nullable=False),
        sa.Column("plan", sa.String(50), server_default="starter", nullable=False),
        sa.Column("duration_days", sa.Integer(), server_default="365", nullable=False),
        sa.Column("max_users", sa.Integer(), server_default="5", nullable=False),
        sa.Column("max_devices", sa.Integer(), server_default="2", nullable=False),
        sa.Column("max_invoices_per_month", sa.Integer(), server_default="500", nullable=False),
        sa.Column("is_used", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("used_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("activation_codes")
    op.drop_table("subscriptions")

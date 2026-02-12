"""Add activation_key column to devices table

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("activation_key", sa.String(100), server_default="", nullable=False))


def downgrade() -> None:
    op.drop_column("devices", "activation_key")

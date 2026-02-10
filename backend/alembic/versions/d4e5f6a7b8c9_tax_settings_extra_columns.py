"""tax_settings_extra_columns

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tax_settings", sa.Column("description", sa.String(255), server_default=""))
    op.add_column("tax_settings", sa.Column("tax_type", sa.String(50), server_default="sales"))
    op.add_column("tax_settings", sa.Column("tax_scope", sa.String(50), server_default="sales"))
    op.add_column("tax_settings", sa.Column("label_on_invoice", sa.String(100), server_default=""))


def downgrade() -> None:
    op.drop_column("tax_settings", "label_on_invoice")
    op.drop_column("tax_settings", "tax_scope")
    op.drop_column("tax_settings", "tax_type")
    op.drop_column("tax_settings", "description")

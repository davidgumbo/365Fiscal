"""company_settings_watermark

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-02-10 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("document_watermark", sa.Text(), server_default=""))
    op.add_column("company_settings", sa.Column("document_watermark_opacity", sa.String(10), server_default="0.08"))


def downgrade() -> None:
    op.drop_column("company_settings", "document_watermark_opacity")
    op.drop_column("company_settings", "document_watermark")

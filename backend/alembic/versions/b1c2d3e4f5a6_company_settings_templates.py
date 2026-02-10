"""company_settings_templates

Revision ID: b1c2d3e4f5a6
Revises: g8h9i0j1k2l3
Create Date: 2026-02-10 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "g8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("document_header", sa.Text(), server_default=""))
    op.add_column("company_settings", sa.Column("document_footer", sa.Text(), server_default=""))


def downgrade() -> None:
    op.drop_column("company_settings", "document_footer")
    op.drop_column("company_settings", "document_header")

"""Add ZIMRA tax fields to tax_settings and tax_id FK to products

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ZIMRA fields on tax_settings
    op.add_column("tax_settings", sa.Column("zimra_tax_id", sa.Integer(), nullable=True))
    op.add_column("tax_settings", sa.Column("zimra_tax_code", sa.String(10), server_default="", nullable=False))
    op.add_column("tax_settings", sa.Column("zimra_valid_from", sa.String(10), nullable=True))
    op.add_column("tax_settings", sa.Column("zimra_valid_till", sa.String(10), nullable=True))
    op.add_column("tax_settings", sa.Column("is_zimra_tax", sa.Boolean(), server_default="false", nullable=False))

    # tax_id FK on products
    op.add_column("products", sa.Column("tax_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_products_tax_id", "products", "tax_settings", ["tax_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_products_tax_id", "products", type_="foreignkey")
    op.drop_column("products", "tax_id")
    op.drop_column("tax_settings", "is_zimra_tax")
    op.drop_column("tax_settings", "zimra_valid_till")
    op.drop_column("tax_settings", "zimra_valid_from")
    op.drop_column("tax_settings", "zimra_tax_code")
    op.drop_column("tax_settings", "zimra_tax_id")

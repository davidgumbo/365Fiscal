"""add odoo settings fields

Revision ID: f2a1c9b8d0a1
Revises: 235b5e8194a7
Create Date: 2026-02-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2a1c9b8d0a1"
down_revision = "235b5e8194a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("logo_data", sa.Text(), server_default="", nullable=False))
    op.add_column("company_settings", sa.Column("document_layout", sa.String(length=100), server_default="external_layout_standard", nullable=False))
    op.add_column("company_settings", sa.Column("customer_account_enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False))
    op.add_column("company_settings", sa.Column("customer_signup_mode", sa.String(length=20), server_default="invitation", nullable=False))
    op.add_column("company_settings", sa.Column("password_reset_enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False))
    op.add_column("company_settings", sa.Column("default_access_rights_enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False))
    op.add_column("company_settings", sa.Column("api_keys_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    op.add_column("company_settings", sa.Column("customer_api_keys_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    op.add_column("company_settings", sa.Column("import_export_enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False))
    op.add_column("company_settings", sa.Column("show_effect_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    op.add_column("company_settings", sa.Column("push_notifications_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    op.add_column("company_settings", sa.Column("disable_mobile_redirect", sa.Boolean(), server_default=sa.text("0"), nullable=False))
    op.add_column("company_settings", sa.Column("inter_company_transactions", sa.Boolean(), server_default=sa.text("0"), nullable=False))


def downgrade() -> None:
    op.drop_column("company_settings", "inter_company_transactions")
    op.drop_column("company_settings", "disable_mobile_redirect")
    op.drop_column("company_settings", "push_notifications_enabled")
    op.drop_column("company_settings", "show_effect_enabled")
    op.drop_column("company_settings", "import_export_enabled")
    op.drop_column("company_settings", "customer_api_keys_enabled")
    op.drop_column("company_settings", "api_keys_enabled")
    op.drop_column("company_settings", "default_access_rights_enabled")
    op.drop_column("company_settings", "password_reset_enabled")
    op.drop_column("company_settings", "customer_signup_mode")
    op.drop_column("company_settings", "customer_account_enabled")
    op.drop_column("company_settings", "document_layout")
    op.drop_column("company_settings", "logo_data")

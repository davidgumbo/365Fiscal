"""add_invoice_sequence_fields

Revision ID: aa9b8c7d6e5
Revises: z2x3c4v5b6
Create Date: 2026-03-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "aa9b8c7d6e5"
down_revision = "z2x3c4v5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "company_settings",
        sa.Column("sequence_size", sa.Integer(), server_default=sa.text("4"), nullable=False),
    )
    op.add_column(
        "company_settings",
        sa.Column("sequence_step", sa.Integer(), server_default=sa.text("1"), nullable=False),
    )
    op.add_column(
        "company_settings",
        sa.Column("sequence_next", sa.Integer(), server_default=sa.text("1"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("company_settings", "sequence_next")
    op.drop_column("company_settings", "sequence_step")
    op.drop_column("company_settings", "sequence_size")

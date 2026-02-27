"""pos_till_warehouse

Revision ID: z2x3c4v5b6
Revises: y1z2a3b4c5d6
Create Date: 2026-02-27 10:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "z2x3c4v5b6"
down_revision = "y1z2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pos_tills",
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pos_tills_warehouse_id",
        "pos_tills",
        "warehouses",
        ["warehouse_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_pos_tills_warehouse_id", "pos_tills", type_="foreignkey")
    op.drop_column("pos_tills", "warehouse_id")

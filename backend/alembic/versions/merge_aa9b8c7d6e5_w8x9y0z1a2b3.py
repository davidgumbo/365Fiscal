"""merge_aa9b8c7d6e5_w8x9y0z1a2b3

Revision ID: merge_aa9b8_w8x9
Revises: aa9b8c7d6e5, w8x9y0z1a2b3
Create Date: 2026-03-02 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "merge_aa9b8_w8x9"
down_revision = ("aa9b8c7d6e5", "w8x9y0z1a2b3")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge-only revision: no schema changes required here.
    pass


def downgrade() -> None:
    # Nothing to do on downgrade for the merge-only revision.
    pass

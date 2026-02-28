"""pos_tills_and_cashier_name

Revision ID: y1z2a3b4c5d6
Revises: x1y2z3_expense_cats
Create Date: 2026-02-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'y1z2a3b4c5d6'
down_revision = 'x1y2z3_expense_cats'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pos_tills table
    op.create_table(
        'pos_tills',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create many-to-many association table
    op.create_table(
        'pos_till_employees',
        sa.Column('till_id', sa.Integer(), sa.ForeignKey('pos_tills.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('employee_id', sa.Integer(), sa.ForeignKey('pos_employees.id', ondelete='CASCADE'), primary_key=True),
    )

    # Add cashier_name and till_id columns to pos_orders
    op.add_column('pos_orders', sa.Column('cashier_name', sa.String(200), server_default='', nullable=True))
    op.add_column('pos_orders', sa.Column('till_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('pos_orders', 'till_id')
    op.drop_column('pos_orders', 'cashier_name')
    op.drop_table('pos_till_employees')
    op.drop_table('pos_tills')

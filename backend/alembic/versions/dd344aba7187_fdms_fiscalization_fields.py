"""fdms_fiscalization_fields

Revision ID: dd344aba7187
Revises: 235b5e8194a7
Create Date: 2026-02-03 12:01:28.279679

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd344aba7187'
down_revision: Union[str, None] = '235b5e8194a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_context().dialect.name

    with op.batch_alter_table('devices') as batch:
        batch.add_column(sa.Column('fiscal_day_status', sa.String(length=50), nullable=False, server_default='closed'))
        batch.add_column(sa.Column('current_fiscal_day_no', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('last_fiscal_day_no', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('last_receipt_counter', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('last_receipt_global_no', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('last_receipt_hash', sa.String(length=512), nullable=False, server_default=''))
        batch.add_column(sa.Column('last_receipt_signature', sa.String(length=2048), nullable=False, server_default=''))
        batch.add_column(sa.Column('qr_url', sa.String(length=255), nullable=False, server_default=''))

    with op.batch_alter_table('invoices') as batch:
        batch.add_column(sa.Column('device_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('zimra_status', sa.String(length=50), nullable=False, server_default='not_submitted'))
        batch.add_column(sa.Column('zimra_receipt_id', sa.String(length=100), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_receipt_counter', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('zimra_receipt_global_no', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('zimra_device_signature', sa.String(length=2048), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_device_hash', sa.String(length=512), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_server_signature', sa.String(length=2048), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_server_hash', sa.String(length=512), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_verification_code', sa.String(length=50), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_verification_url', sa.String(length=255), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_payload', sa.String(length=10000), nullable=False, server_default=''))
        batch.add_column(sa.Column('zimra_errors', sa.String(length=2000), nullable=False, server_default=''))
        if dialect != 'sqlite':
            batch.create_foreign_key(None, 'devices', ['device_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('invoices') as batch:
        if op.get_context().dialect.name != 'sqlite':
            batch.drop_constraint(None, type_='foreignkey')
        batch.drop_column('zimra_errors')
        batch.drop_column('zimra_payload')
        batch.drop_column('zimra_verification_url')
        batch.drop_column('zimra_verification_code')
        batch.drop_column('zimra_server_hash')
        batch.drop_column('zimra_server_signature')
        batch.drop_column('zimra_device_hash')
        batch.drop_column('zimra_device_signature')
        batch.drop_column('zimra_receipt_global_no')
        batch.drop_column('zimra_receipt_counter')
        batch.drop_column('zimra_receipt_id')
        batch.drop_column('zimra_status')
        batch.drop_column('device_id')

    with op.batch_alter_table('devices') as batch:
        batch.drop_column('qr_url')
        batch.drop_column('last_receipt_signature')
        batch.drop_column('last_receipt_hash')
        batch.drop_column('last_receipt_global_no')
        batch.drop_column('last_receipt_counter')
        batch.drop_column('last_fiscal_day_no')
        batch.drop_column('current_fiscal_day_no')
        batch.drop_column('fiscal_day_status')

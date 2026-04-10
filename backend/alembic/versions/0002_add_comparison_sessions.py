"""Add comparison_sessions table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'comparison_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_uuid', sa.String(length=36), nullable=False),
        sa.Column('generator_ids', sa.JSON(), nullable=False),
        sa.Column('load_pct', sa.Float(), nullable=False),
        sa.Column('fuel_price_per_liter', sa.Float(), nullable=False),
        sa.Column('results_cache', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_uuid'),
    )
    op.create_index('ix_comparison_sessions_session_uuid', 'comparison_sessions', ['session_uuid'])


def downgrade():
    op.drop_index('ix_comparison_sessions_session_uuid', table_name='comparison_sessions')
    op.drop_table('comparison_sessions')

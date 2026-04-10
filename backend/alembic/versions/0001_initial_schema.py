"""Initial schema — generators, bess_systems, load_profiles

Revision ID: 0001
Revises:
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'generators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('oem', sa.String(length=100), nullable=False),
        sa.Column('model', sa.String(length=200), nullable=False),
        sa.Column('kw_rating', sa.Float(), nullable=False),
        sa.Column('kva_rating', sa.Float(), nullable=True),
        sa.Column('fuel_type', sa.String(length=50), nullable=False, server_default='diesel'),
        sa.Column('fuel_curve', sa.JSON(), nullable=True),
        sa.Column('emissions_data', sa.JSON(), nullable=True),
        sa.Column('dimensions_mm', sa.JSON(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('noise_db_at_7m', sa.Float(), nullable=True),
        sa.Column('emissions_standard', sa.String(length=100), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_generators_oem', 'generators', ['oem'])
    op.create_index('ix_generators_fuel_type', 'generators', ['fuel_type'])

    op.create_table(
        'bess_systems',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('manufacturer', sa.String(length=100), nullable=False),
        sa.Column('model', sa.String(length=200), nullable=False),
        sa.Column('capacity_kwh', sa.Float(), nullable=False),
        sa.Column('power_kw', sa.Float(), nullable=False),
        sa.Column('round_trip_efficiency', sa.Float(), nullable=False, server_default='0.92'),
        sa.Column('min_soc', sa.Float(), nullable=False, server_default='0.2'),
        sa.Column('max_soc', sa.Float(), nullable=False, server_default='0.95'),
        sa.Column('chemistry', sa.String(length=50), nullable=True),
        sa.Column('container_type', sa.String(length=100), nullable=True),
        sa.Column('dimensions_mm', sa.JSON(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'load_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('sector', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_preset', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('hourly_kw', sa.JSON(), nullable=False),
        sa.Column('peak_kw', sa.Float(), nullable=True),
        sa.Column('avg_kw', sa.Float(), nullable=True),
        sa.Column('load_factor', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_load_profiles_sector', 'load_profiles', ['sector'])


def downgrade():
    op.drop_index('ix_load_profiles_sector', table_name='load_profiles')
    op.drop_table('load_profiles')
    op.drop_index('ix_generators_fuel_type', table_name='generators')
    op.drop_index('ix_generators_oem', table_name='generators')
    op.drop_table('bess_systems')
    op.drop_table('generators')

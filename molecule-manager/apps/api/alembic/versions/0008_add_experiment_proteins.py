"""Add experiment_proteins join table.

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiment_proteins",
        sa.Column("experiment_id", sa.Uuid(), nullable=False),
        sa.Column("protein_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["protein_id"], ["proteins.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("experiment_id", "protein_id", name="pk_experiment_proteins"),
    )


def downgrade() -> None:
    op.drop_table("experiment_proteins")

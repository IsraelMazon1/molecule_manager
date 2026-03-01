"""add audit_logs table

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lab_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("entity_name", sa.String(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["labs.id"], ondelete="CASCADE",
            name="fk_audit_logs_lab_id",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL",
            name="fk_audit_logs_user_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index(
        "ix_audit_logs_lab_id_created_at",
        "audit_logs",
        ["lab_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_lab_id_created_at", table_name="audit_logs")
    op.drop_table("audit_logs")

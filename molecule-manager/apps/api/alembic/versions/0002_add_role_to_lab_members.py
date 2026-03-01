"""add role to lab_members

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lab_members",
        sa.Column(
            "role",
            sa.String(),
            nullable=False,
            server_default="STUDENT",
        ),
    )
    # Backfill: promote lab creators to PI
    op.execute(
        """
        UPDATE lab_members lm
        SET role = 'PI'
        FROM labs l
        WHERE lm.lab_id = l.id
          AND lm.user_id = l.created_by_user_id
        """
    )


def downgrade() -> None:
    op.drop_column("lab_members", "role")

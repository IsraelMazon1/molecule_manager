"""add inchi and inchikey columns to molecules

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("molecules", sa.Column("inchi", sa.Text(), nullable=True))
    op.add_column("molecules", sa.Column("inchikey", sa.String(27), nullable=True))
    op.create_index(
        "ix_molecules_lab_id_inchikey",
        "molecules",
        ["lab_id", "inchikey"],
    )


def downgrade() -> None:
    op.drop_index("ix_molecules_lab_id_inchikey", table_name="molecules")
    op.drop_column("molecules", "inchikey")
    op.drop_column("molecules", "inchi")

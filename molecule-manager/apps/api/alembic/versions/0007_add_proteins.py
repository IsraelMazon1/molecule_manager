"""Add proteins table.

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "proteins",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lab_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("uniprot_id", sa.String(), nullable=True),
        sa.Column("pdb_id", sa.String(), nullable=True),
        sa.Column("sequence", sa.Text(), nullable=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["lab_id"], ["labs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proteins_lab_id_name", "proteins", ["lab_id", "name"])
    op.create_index("ix_proteins_lab_id_pdb_id", "proteins", ["lab_id", "pdb_id"])
    op.create_index("ix_proteins_uniprot_id", "proteins", ["uniprot_id"])
    op.create_index("ix_proteins_pdb_id", "proteins", ["pdb_id"])


def downgrade() -> None:
    op.drop_index("ix_proteins_pdb_id", table_name="proteins")
    op.drop_index("ix_proteins_uniprot_id", table_name="proteins")
    op.drop_index("ix_proteins_lab_id_pdb_id", table_name="proteins")
    op.drop_index("ix_proteins_lab_id_name", table_name="proteins")
    op.drop_table("proteins")

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # ------------------------------------------------------------------
    # labs
    # ------------------------------------------------------------------
    op.create_table(
        "labs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("lab_code", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL",
            name="fk_labs_created_by_user_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_labs"),
        sa.UniqueConstraint("lab_code", name="uq_labs_lab_code"),
    )

    # ------------------------------------------------------------------
    # lab_members
    # ------------------------------------------------------------------
    op.create_table(
        "lab_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lab_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["labs.id"], ondelete="CASCADE",
            name="fk_lab_members_lab_id",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE",
            name="fk_lab_members_user_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_lab_members"),
        sa.UniqueConstraint("lab_id", "user_id", name="uq_lab_members_lab_user"),
    )

    # ------------------------------------------------------------------
    # molecules
    # ------------------------------------------------------------------
    op.create_table(
        "molecules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lab_id", sa.UUID(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("smiles", sa.String(), nullable=False),
        sa.Column("canonical_smiles", sa.String(), nullable=True),
        sa.Column("date_created", sa.Date(), nullable=False),
        sa.Column("method_used", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("molecular_weight", sa.Float(), nullable=True),
        sa.Column("molecular_formula", sa.String(), nullable=True),
        sa.Column("hbd", sa.Integer(), nullable=True),
        sa.Column("hba", sa.Integer(), nullable=True),
        sa.Column("tpsa", sa.Float(), nullable=True),
        sa.Column("rotatable_bonds", sa.Integer(), nullable=True),
        sa.Column("svg_image", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["labs.id"], ondelete="CASCADE",
            name="fk_molecules_lab_id",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL",
            name="fk_molecules_created_by_user_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_molecules"),
    )
    op.create_index("ix_molecules_lab_id_name", "molecules", ["lab_id", "name"])
    op.create_index("ix_molecules_lab_id_smiles", "molecules", ["lab_id", "smiles"])

    # ------------------------------------------------------------------
    # experiments
    # ------------------------------------------------------------------
    op.create_table(
        "experiments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lab_id", sa.UUID(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["labs.id"], ondelete="CASCADE",
            name="fk_experiments_lab_id",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL",
            name="fk_experiments_created_by_user_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_experiments"),
    )

    # ------------------------------------------------------------------
    # experiment_molecules  (composite-PK join table, no surrogate key)
    # ------------------------------------------------------------------
    op.create_table(
        "experiment_molecules",
        sa.Column("experiment_id", sa.UUID(), nullable=False),
        sa.Column("molecule_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["experiment_id"], ["experiments.id"], ondelete="CASCADE",
            name="fk_em_experiment_id",
        ),
        sa.ForeignKeyConstraint(
            ["molecule_id"], ["molecules.id"], ondelete="CASCADE",
            name="fk_em_molecule_id",
        ),
        sa.PrimaryKeyConstraint("experiment_id", "molecule_id", name="pk_experiment_molecules"),
    )


def downgrade() -> None:
    op.drop_table("experiment_molecules")
    op.drop_index("ix_molecules_lab_id_smiles", table_name="molecules")
    op.drop_index("ix_molecules_lab_id_name", table_name="molecules")
    op.drop_table("experiments")
    op.drop_table("molecules")
    op.drop_table("lab_members")
    op.drop_table("labs")
    op.drop_table("users")

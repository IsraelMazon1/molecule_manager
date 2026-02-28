import uuid

from sqlalchemy import ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExperimentMolecule(Base):
    __tablename__ = "experiment_molecules"
    __table_args__ = (
        PrimaryKeyConstraint("experiment_id", "molecule_id", name="pk_experiment_molecules"),
    )

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False
    )
    molecule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("molecules.id", ondelete="CASCADE"), nullable=False
    )

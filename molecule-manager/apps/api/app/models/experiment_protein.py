import uuid

from sqlalchemy import ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExperimentProtein(Base):
    __tablename__ = "experiment_proteins"
    __table_args__ = (
        PrimaryKeyConstraint("experiment_id", "protein_id", name="pk_experiment_proteins"),
    )

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False
    )
    protein_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proteins.id", ondelete="CASCADE"), nullable=False
    )

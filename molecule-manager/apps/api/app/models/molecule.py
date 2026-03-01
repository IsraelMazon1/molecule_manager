import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Molecule(Base):
    __tablename__ = "molecules"
    __table_args__ = (
        Index("ix_molecules_lab_id_name", "lab_id", "name"),
        Index("ix_molecules_lab_id_smiles", "lab_id", "smiles"),
        Index("ix_molecules_lab_id_inchikey", "lab_id", "inchikey"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lab_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("labs.id", ondelete="CASCADE"), nullable=False
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    smiles: Mapped[str] = mapped_column(String, nullable=False)
    canonical_smiles: Mapped[str | None] = mapped_column(String, nullable=True)
    inchi: Mapped[str | None] = mapped_column(Text, nullable=True)
    inchikey: Mapped[str | None] = mapped_column(String(27), nullable=True)
    morgan_fingerprint: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_created: Mapped[date] = mapped_column(Date, nullable=False)
    method_used: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    molecular_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    molecular_formula: Mapped[str | None] = mapped_column(String, nullable=True)
    hbd: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hba: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tpsa: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotatable_bonds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    svg_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

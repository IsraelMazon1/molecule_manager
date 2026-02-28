import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.lab import Lab
from app.models.molecule import Molecule
from app.models.user import User
from app.schemas.molecule import CreateMoleculeRequest, MoleculeResponse
from app.services.chemistry import InvalidSMILESError
from app.services.molecule import create_molecule

router = APIRouter(prefix="/api/v1/labs/{lab_id}/molecules", tags=["molecules"])


@router.post("/", response_model=MoleculeResponse, status_code=status.HTTP_201_CREATED)
def create(
    body: CreateMoleculeRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Molecule:
    try:
        return create_molecule(
            db,
            lab_id=lab.id,
            created_by_user_id=current_user.id,
            name=body.name,
            smiles=body.smiles,
            date_created=body.date_created,
            method_used=body.method_used,
            notes=body.notes,
        )
    except InvalidSMILESError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("/", response_model=list[MoleculeResponse])
def list_molecules(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
    name: str | None = Query(default=None, description="Case-insensitive substring match on name"),
    smiles: str | None = Query(default=None, description="Exact match on canonical_smiles"),
    method: str | None = Query(default=None, description="Case-insensitive substring match on method_used"),
    date_from: date | None = Query(default=None, description="Include molecules with date_created >= date_from"),
    date_to: date | None = Query(default=None, description="Include molecules with date_created <= date_to"),
) -> list[Molecule]:
    stmt = (
        select(Molecule)
        .where(Molecule.lab_id == lab.id)  # isolation enforced here
        .order_by(Molecule.created_at.desc())
    )

    if name is not None:
        stmt = stmt.where(Molecule.name.ilike(f"%{name}%"))
    if smiles is not None:
        # Match against the stored canonical form so different representations
        # of the same molecule all resolve to a single canonical query target.
        stmt = stmt.where(Molecule.canonical_smiles == smiles)
    if method is not None:
        stmt = stmt.where(Molecule.method_used.ilike(f"%{method}%"))
    if date_from is not None:
        stmt = stmt.where(Molecule.date_created >= date_from)
    if date_to is not None:
        stmt = stmt.where(Molecule.date_created <= date_to)

    return list(db.execute(stmt).scalars().all())


@router.get("/{molecule_id}", response_model=MoleculeResponse)
def get_one(
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> Molecule:
    mol = db.execute(
        select(Molecule).where(
            Molecule.id == molecule_id,
            Molecule.lab_id == lab.id,  # isolation enforced here
        )
    ).scalar_one_or_none()

    if not mol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Molecule not found")
    return mol


@router.delete("/{molecule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> None:
    mol = db.execute(
        select(Molecule).where(
            Molecule.id == molecule_id,
            Molecule.lab_id == lab.id,  # isolation enforced here
        )
    ).scalar_one_or_none()

    if not mol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Molecule not found")

    db.delete(mol)
    db.commit()

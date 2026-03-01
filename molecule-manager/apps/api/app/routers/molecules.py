import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.molecule import Molecule
from app.models.user import User
from app.schemas.molecule import CreateMoleculeRequest, ImportPubChemRequest, MoleculeResponse, SimilarityHit, SimilaritySearchRequest, SubstructureSearchRequest, UpdateMoleculeRequest
from app.services.audit import log_action
from app.services.chemistry import InvalidSMILESError, bulk_tanimoto, is_substructure, process_smiles
from app.services.molecule import create_molecule
from app.services.pubchem import fetch_pubchem_by_cid

router = APIRouter(prefix="/api/v1/labs/{lab_id}/molecules", tags=["molecules"])


def _get_member_role(lab_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> MemberRole:
    member = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == user_id,
        )
    ).scalar_one_or_none()
    return member.role if member else MemberRole.STUDENT


@router.post("/", response_model=MoleculeResponse, status_code=status.HTTP_201_CREATED)
def create(
    body: CreateMoleculeRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Molecule:
    try:
        mol = create_molecule(
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
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="MOLECULE",
        entity_id=mol.id,
        entity_name=mol.name,
    )
    return mol


@router.get("/", response_model=list[MoleculeResponse])
def list_molecules(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
    name: str | None = Query(default=None, description="Case-insensitive substring match on name"),
    smiles: str | None = Query(default=None, description="Exact match on canonical_smiles"),
    method: str | None = Query(default=None, description="Case-insensitive substring match on method_used"),
    date_from: date | None = Query(default=None, description="Include molecules with date_created >= date_from"),
    date_to: date | None = Query(default=None, description="Include molecules with date_created <= date_to"),
    inchikey: str | None = Query(default=None, description="Exact InChIKey match"),
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
    if inchikey is not None:
        stmt = stmt.where(Molecule.inchikey == inchikey)

    return list(db.execute(stmt).scalars().all())


@router.post("/import-pubchem", response_model=MoleculeResponse, status_code=status.HTTP_201_CREATED)
def import_from_pubchem(
    body: ImportPubChemRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Molecule:
    """Fetch compound data from PubChem by CID and create a molecule in the lab."""
    try:
        compound = fetch_pubchem_by_cid(body.pubchem_cid)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"PubChem error: {exc}",
        )

    if not compound or not compound.get("smiles"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PubChem CID {body.pubchem_cid} not found or has no SMILES",
        )

    try:
        mol = create_molecule(
            db,
            lab_id=lab.id,
            created_by_user_id=current_user.id,
            name=body.name,
            smiles=compound["smiles"],
            date_created=body.date_created,
            method_used=body.method_used,
            notes=body.notes,
        )
    except InvalidSMILESError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="MOLECULE",
        entity_id=mol.id,
        entity_name=mol.name,
        detail=f"Imported from PubChem CID {body.pubchem_cid}",
    )
    return mol


@router.post("/substructure-search", response_model=list[MoleculeResponse])
def substructure_search(
    body: SubstructureSearchRequest,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> list[Molecule]:
    """Return all molecules in the lab whose structure contains the query fragment."""
    try:
        process_smiles(body.smiles)  # validates query SMILES
    except InvalidSMILESError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    all_mols = db.execute(
        select(Molecule).where(Molecule.lab_id == lab.id)
    ).scalars().all()

    return [
        mol for mol in all_mols
        if mol.canonical_smiles and is_substructure(body.smiles, mol.canonical_smiles)
    ]


@router.post("/similarity-search", response_model=list[SimilarityHit])
def similarity_search(
    body: SimilaritySearchRequest,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return lab molecules with Tanimoto similarity >= threshold, sorted descending."""
    try:
        process_smiles(body.query_smiles)  # validates query SMILES
    except InvalidSMILESError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    all_mols = db.execute(
        select(Molecule).where(Molecule.lab_id == lab.id)
    ).scalars().all()

    # Compute query fingerprint once against all stored bit strings
    scores = bulk_tanimoto(
        body.query_smiles,
        [mol.morgan_fingerprint for mol in all_mols],
    )

    hits = [
        {**MoleculeResponse.model_validate(mol).model_dump(), "similarity": round(score, 4)}
        for mol, score in zip(all_mols, scores)
        if score >= body.threshold
    ]
    hits.sort(key=lambda h: h["similarity"], reverse=True)
    return hits


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


@router.patch("/{molecule_id}", response_model=MoleculeResponse)
def update(
    molecule_id: uuid.UUID,
    body: UpdateMoleculeRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Molecule:
    mol = db.execute(
        select(Molecule).where(
            Molecule.id == molecule_id,
            Molecule.lab_id == lab.id,
        )
    ).scalar_one_or_none()

    if not mol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Molecule not found")

    role = _get_member_role(lab.id, current_user.id, db)
    if mol.created_by_user_id != current_user.id and role != MemberRole.PI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator or a PI can edit this molecule",
        )

    if body.name is not None:
        mol.name = body.name
    if body.date_created is not None:
        mol.date_created = body.date_created
    if body.method_used is not None:
        mol.method_used = body.method_used
    if body.notes is not None:
        mol.notes = body.notes

    mol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mol)
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="UPDATE",
        entity_type="MOLECULE",
        entity_id=mol.id,
        entity_name=mol.name,
    )
    return mol


@router.delete("/{molecule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
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

    role = _get_member_role(lab.id, current_user.id, db)
    if mol.created_by_user_id != current_user.id and role != MemberRole.PI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator or a PI can delete this molecule",
        )

    mol_id = mol.id
    mol_name = mol.name
    db.delete(mol)
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="DELETE",
        entity_type="MOLECULE",
        entity_id=mol_id,
        entity_name=mol_name,
    )

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.molecule import Molecule
from app.models.user import User
from app.schemas.molecule import BulkCreateRequest, CreateMoleculeRequest, ImportPubChemRequest, MolFileParseResponse, MolFilePreview, MoleculeResponse, SimilarityHit, SimilaritySearchRequest, SubstructureSearchRequest, UpdateMoleculeRequest
from app.services.audit import log_action
from app.services.chemistry import InvalidMolFileError, InvalidSMILESError, bulk_tanimoto, is_substructure, parse_mol_file, parse_sdf_file, process_smiles
from app.services.import_excel import MAX_FILE_SIZE, bulk_import_molecules, parse_spreadsheet
from app.services.notifications import notify
from app.services.molecule import create_molecule
from app.services.pubchem import fetch_pubchem_by_cid
from app.utils.search import escape_like

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
        stmt = stmt.where(Molecule.name.ilike(f"%{escape_like(name)}%", escape="\\"))
    if smiles is not None:
        # Match against the stored canonical form so different representations
        # of the same molecule all resolve to a single canonical query target.
        stmt = stmt.where(Molecule.canonical_smiles == smiles)
    if method is not None:
        stmt = stmt.where(Molecule.method_used.ilike(f"%{escape_like(method)}%", escape="\\"))
    if date_from is not None:
        stmt = stmt.where(Molecule.date_created >= date_from)
    if date_to is not None:
        stmt = stmt.where(Molecule.date_created <= date_to)
    if inchikey is not None:
        stmt = stmt.where(Molecule.inchikey == inchikey)

    return list(db.execute(stmt).scalars().all())


@router.post("/import-mol", response_model=MolFileParseResponse)
async def import_mol_file(
    file: UploadFile = File(...),
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Parse a MOL or SDF file and return previews (no save)."""
    MAX_MOL_SIZE = 10 * 1024 * 1024  # 10 MB
    if file.size and file.size > MAX_MOL_SIZE:
        raise HTTPException(413, "File too large. Max 10 MB.")
    raw = await file.read()
    if len(raw) > MAX_MOL_SIZE:
        raise HTTPException(413, "File too large. Max 10 MB.")
    content = raw.decode("utf-8", errors="replace")
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".sdf"):
            smiles_list = parse_sdf_file(content)
        else:
            smiles_list = [parse_mol_file(content)]
    except InvalidMolFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    previews: list[dict] = []
    for smi in smiles_list:
        try:
            props = process_smiles(smi)
            previews.append(
                MolFilePreview(
                    smiles=smi,
                    canonical_smiles=props["canonical_smiles"],
                    molecular_weight=props["molecular_weight"],
                    molecular_formula=props["molecular_formula"],
                    hbd=props["hbd"],
                    hba=props["hba"],
                    tpsa=props["tpsa"],
                    rotatable_bonds=props["rotatable_bonds"],
                    svg_image=props["svg_image"],
                ).model_dump()
            )
        except InvalidSMILESError:
            continue

    if not previews:
        raise HTTPException(status_code=422, detail="No valid molecules found in file")

    return {"molecules": previews}


@router.post("/import/preview")
async def import_spreadsheet_preview(
    file: UploadFile = File(...),
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Parse an Excel/CSV file and return columns, rows, and suggested column mapping."""
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the 5 MB size limit",
        )
    filename = file.filename or "upload.csv"
    try:
        result = parse_spreadsheet(file_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@router.post("/import/commit")
def import_spreadsheet_commit(
    body: dict,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Commit a spreadsheet import using the provided rows and column mapping."""
    rows = body.get("rows")
    mapping = body.get("mapping")
    if not rows or not isinstance(rows, list):
        raise HTTPException(status_code=422, detail="rows is required and must be a list")
    if not mapping or not isinstance(mapping, dict):
        raise HTTPException(status_code=422, detail="mapping is required and must be an object")
    if len(rows) > 1000:
        raise HTTPException(status_code=422, detail="Maximum 1000 rows per import")
    if not mapping.get("smiles"):
        raise HTTPException(status_code=422, detail="SMILES column mapping is required")

    try:
        result = bulk_import_molecules(
            db,
            lab_id=lab.id,
            user_id=current_user.id,
            rows=rows,
            mapping=mapping,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if result["imported"] > 0:
        log_action(
            db,
            lab_id=lab.id,
            user_id=current_user.id,
            action="CREATE",
            entity_type="MOLECULE",
            entity_id=current_user.id,
            entity_name=f"Spreadsheet import ({result['imported']} molecules)",
            detail=f"Bulk imported {result['imported']} molecules from spreadsheet"
            + (f", {len(result['failed'])} failed" if result["failed"] else ""),
        )

    return result


@router.post("/bulk-create", response_model=list[MoleculeResponse], status_code=status.HTTP_201_CREATED)
def bulk_create(
    body: BulkCreateRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Molecule]:
    """Create up to 50 molecules in a single transaction."""
    created: list[Molecule] = []
    for item in body.molecules:
        try:
            mol = create_molecule(
                db,
                lab_id=lab.id,
                created_by_user_id=current_user.id,
                name=item.name,
                smiles=item.smiles,
                date_created=item.date_created,
                method_used=item.method_used,
                notes=item.notes,
            )
            created.append(mol)
        except InvalidSMILESError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid SMILES for '{item.name}': {exc}")

    for mol in created:
        log_action(
            db,
            lab_id=lab.id,
            user_id=current_user.id,
            action="CREATE",
            entity_type="MOLECULE",
            entity_id=mol.id,
            entity_name=mol.name,
            detail="Bulk import",
        )
    return created


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
    # Notify the creator if someone else edited their molecule
    if mol.created_by_user_id and mol.created_by_user_id != current_user.id:
        notify(
            db,
            user_id=mol.created_by_user_id,
            lab_id=lab.id,
            type="molecule_edited",
            title="Your molecule was edited",
            message=f"'{mol.name}' was edited by {current_user.email}.",
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
    mol_creator_id = mol.created_by_user_id
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
    # Notify the creator if someone else deleted their molecule
    if mol_creator_id and mol_creator_id != current_user.id:
        notify(
            db,
            user_id=mol_creator_id,
            lab_id=lab.id,
            type="molecule_deleted",
            title="Your molecule was deleted",
            message=f"'{mol_name}' was deleted by {current_user.email}.",
        )

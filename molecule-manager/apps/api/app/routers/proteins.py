import uuid
from enum import Enum

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.protein import Protein
from app.models.user import User
from app.schemas.protein import ProteinCreate, ProteinDetail, ProteinList, ProteinPageResponse, ProteinResolve, ProteinResolveResponse
from app.services.audit import log_action
from app.services.protein_resolution import resolve_protein
from app.utils.search import escape_like

router = APIRouter(prefix="/api/v1/labs/{lab_id}/proteins", tags=["proteins"])


def _get_member_role(lab_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> MemberRole:
    member = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == user_id,
        )
    ).scalar_one_or_none()
    return member.role if member else MemberRole.STUDENT


@router.post("/resolve", response_model=ProteinResolveResponse)
def resolve(
    body: ProteinResolve,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = resolve_protein(body.query)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result["error"],
        )
    return result


@router.post("/", response_model=ProteinDetail, status_code=status.HTTP_201_CREATED)
def create(
    body: ProteinCreate,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Protein:
    protein = Protein(
        lab_id=lab.id,
        created_by_user_id=current_user.id,
        name=body.name,
        display_name=body.display_name,
        uniprot_id=body.uniprot_id,
        pdb_id=body.pdb_id,
        sequence=body.sequence,
        source=body.source,
        notes=body.notes,
    )
    db.add(protein)
    db.commit()
    db.refresh(protein)
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="PROTEIN",
        entity_id=protein.id,
        entity_name=protein.name,
    )
    return protein


class ProteinSort(str, Enum):
    created_at_desc = "created_at_desc"
    created_at_asc = "created_at_asc"
    name_asc = "name_asc"
    name_desc = "name_desc"


_SORT_MAP = {
    ProteinSort.created_at_desc: Protein.created_at.desc(),
    ProteinSort.created_at_asc: Protein.created_at.asc(),
    ProteinSort.name_asc: Protein.name.asc(),
    ProteinSort.name_desc: Protein.name.desc(),
}


@router.get("/", response_model=ProteinPageResponse)
def list_proteins(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
    name: str | None = Query(default=None, description="Case-insensitive substring match on name"),
    pdb_id: str | None = Query(default=None, description="Exact PDB ID match"),
    uniprot_id: str | None = Query(default=None, description="Exact UniProt ID match"),
    source: str | None = Query(default=None, description="Filter by source enum"),
    sort: ProteinSort = Query(default=ProteinSort.created_at_desc),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    base = select(Protein).where(Protein.lab_id == lab.id)

    if name is not None:
        base = base.where(Protein.name.ilike(f"%{escape_like(name)}%", escape="\\"))
    if pdb_id is not None:
        base = base.where(Protein.pdb_id == pdb_id)
    if uniprot_id is not None:
        base = base.where(Protein.uniprot_id == uniprot_id)
    if source is not None:
        base = base.where(Protein.source == source)

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()

    items = list(
        db.execute(
            base.order_by(_SORT_MAP[sort]).limit(limit).offset(offset)
        ).scalars().all()
    )

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{protein_id}", response_model=ProteinDetail)
def get_one(
    protein_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> Protein:
    protein = db.execute(
        select(Protein).where(
            Protein.id == protein_id,
            Protein.lab_id == lab.id,
        )
    ).scalar_one_or_none()
    if not protein:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protein not found")
    return protein


@router.get("/{protein_id}/structure", response_class=PlainTextResponse)
def get_structure(
    protein_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    protein = db.execute(
        select(Protein).where(
            Protein.id == protein_id,
            Protein.lab_id == lab.id,
        )
    ).scalar_one_or_none()
    if not protein:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protein not found")
    if not protein.pdb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This protein has no PDB ID — no 3D structure available",
        )
    try:
        resp = httpx.get(
            f"https://files.rcsb.org/download/{protein.pdb_id}.pdb",
            timeout=15.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDB file for '{protein.pdb_id}' not found on RCSB",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"RCSB returned status {exc.response.status_code}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch PDB file from RCSB",
        )
    return PlainTextResponse(content=resp.text, media_type="text/plain")


@router.delete("/{protein_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    protein_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    protein = db.execute(
        select(Protein).where(
            Protein.id == protein_id,
            Protein.lab_id == lab.id,
        )
    ).scalar_one_or_none()
    if not protein:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protein not found")

    role = _get_member_role(lab.id, current_user.id, db)
    if protein.created_by_user_id != current_user.id and role != MemberRole.PI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator or a PI can delete this protein",
        )

    protein_id_val = protein.id
    protein_name = protein.name
    db.delete(protein)
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="DELETE",
        entity_type="PROTEIN",
        entity_id=protein_id_val,
        entity_name=protein_name,
    )

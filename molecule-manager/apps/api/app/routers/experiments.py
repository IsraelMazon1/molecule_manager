import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.experiment import Experiment
from app.models.experiment_molecule import ExperimentMolecule
from app.models.experiment_protein import ExperimentProtein
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.molecule import Molecule
from app.models.protein import Protein
from app.models.user import User
from app.schemas.experiment import (
    CreateExperimentRequest,
    ExperimentDetailResponse,
    ExperimentResponse,
)
from app.services.audit import log_action
from app.services.notifications import notify

router = APIRouter(prefix="/api/v1/labs/{lab_id}/experiments", tags=["experiments"])


def _get_experiment(experiment_id: uuid.UUID, lab_id: uuid.UUID, db: Session) -> Experiment:
    """Fetch an experiment that belongs to lab_id, or raise 404."""
    exp = db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.lab_id == lab_id,
        )
    ).scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    return exp


def _get_molecules_for(experiment_id: uuid.UUID, db: Session) -> list[Molecule]:
    return list(
        db.execute(
            select(Molecule)
            .join(ExperimentMolecule, Molecule.id == ExperimentMolecule.molecule_id)
            .where(ExperimentMolecule.experiment_id == experiment_id)
            .order_by(Molecule.created_at.asc())
        ).scalars().all()
    )


def _get_proteins_for(experiment_id: uuid.UUID, db: Session) -> list[Protein]:
    return list(
        db.execute(
            select(Protein)
            .join(ExperimentProtein, Protein.id == ExperimentProtein.protein_id)
            .where(ExperimentProtein.experiment_id == experiment_id)
            .order_by(Protein.created_at.asc())
        ).scalars().all()
    )


@router.post("/", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
def create(
    body: CreateExperimentRequest,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Experiment:
    exp = Experiment(
        lab_id=lab.id,
        created_by_user_id=current_user.id,
        title=body.title,
        date=body.date,
        notes=body.notes,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="EXPERIMENT",
        entity_id=exp.id,
        entity_name=exp.title,
    )
    return exp


@router.get("/", response_model=list[ExperimentResponse])
def list_experiments(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> list[Experiment]:
    return list(
        db.execute(
            select(Experiment)
            .where(Experiment.lab_id == lab.id)
            .order_by(Experiment.created_at.desc())
        ).scalars().all()
    )


@router.get("/{experiment_id}", response_model=ExperimentDetailResponse)
def get_one(
    experiment_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> ExperimentDetailResponse:
    exp = _get_experiment(experiment_id, lab.id, db)
    molecules = _get_molecules_for(exp.id, db)
    proteins = _get_proteins_for(exp.id, db)
    return ExperimentDetailResponse.model_validate(
        {**exp.__dict__, "molecules": molecules, "proteins": proteins}
    )


@router.post(
    "/{experiment_id}/molecules/{molecule_id}",
    response_model=ExperimentDetailResponse,
    status_code=status.HTTP_200_OK,
)
def attach_molecule(
    experiment_id: uuid.UUID,
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExperimentDetailResponse:
    exp = _get_experiment(experiment_id, lab.id, db)

    # Verify molecule belongs to the same lab — never allow cross-lab attachment.
    mol = db.execute(
        select(Molecule).where(
            Molecule.id == molecule_id,
            Molecule.lab_id == lab.id,
        )
    ).scalar_one_or_none()
    if not mol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Molecule not found")

    already = db.execute(
        select(ExperimentMolecule).where(
            ExperimentMolecule.experiment_id == exp.id,
            ExperimentMolecule.molecule_id == mol.id,
        )
    ).scalar_one_or_none()
    if already:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Molecule already attached to this experiment",
        )

    db.add(ExperimentMolecule(experiment_id=exp.id, molecule_id=mol.id))
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="EXPERIMENT_MOLECULE",
        entity_id=exp.id,
        entity_name=f"{exp.title} ← {mol.name}",
        detail=f"Attached molecule '{mol.name}' to experiment '{exp.title}'",
    )
    # Notify the experiment creator if someone else attached a molecule
    if exp.created_by_user_id and exp.created_by_user_id != current_user.id:
        notify(
            db,
            user_id=exp.created_by_user_id,
            lab_id=lab.id,
            type="molecule_attached",
            title="Molecule added to your experiment",
            message=f"'{mol.name}' was attached to '{exp.title}' by {current_user.email}.",
        )

    molecules = _get_molecules_for(exp.id, db)
    proteins = _get_proteins_for(exp.id, db)
    return ExperimentDetailResponse.model_validate(
        {**exp.__dict__, "molecules": molecules, "proteins": proteins}
    )


@router.delete(
    "/{experiment_id}/molecules/{molecule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_molecule(
    experiment_id: uuid.UUID,
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    exp = _get_experiment(experiment_id, lab.id, db)

    link = db.execute(
        select(ExperimentMolecule).where(
            ExperimentMolecule.experiment_id == exp.id,
            ExperimentMolecule.molecule_id == molecule_id,
        )
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Molecule not attached to this experiment",
        )

    mol = db.get(Molecule, molecule_id)
    exp_title = exp.title
    exp_id = exp.id
    mol_name = mol.name if mol else str(molecule_id)

    db.delete(link)
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="DELETE",
        entity_type="EXPERIMENT_MOLECULE",
        entity_id=exp_id,
        entity_name=f"{exp_title} ← {mol_name}",
        detail=f"Detached molecule '{mol_name}' from experiment '{exp_title}'",
    )


@router.post(
    "/{experiment_id}/proteins/{protein_id}",
    response_model=ExperimentDetailResponse,
    status_code=status.HTTP_200_OK,
)
def attach_protein(
    experiment_id: uuid.UUID,
    protein_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExperimentDetailResponse:
    exp = _get_experiment(experiment_id, lab.id, db)

    prot = db.execute(
        select(Protein).where(
            Protein.id == protein_id,
            Protein.lab_id == lab.id,
        )
    ).scalar_one_or_none()
    if not prot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Protein not found")

    already = db.execute(
        select(ExperimentProtein).where(
            ExperimentProtein.experiment_id == exp.id,
            ExperimentProtein.protein_id == prot.id,
        )
    ).scalar_one_or_none()
    if already:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protein already attached to this experiment",
        )

    db.add(ExperimentProtein(experiment_id=exp.id, protein_id=prot.id))
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="EXPERIMENT_PROTEIN",
        entity_id=exp.id,
        entity_name=f"{exp.title} ← {prot.name}",
        detail=f"Attached protein '{prot.name}' to experiment '{exp.title}'",
    )

    molecules = _get_molecules_for(exp.id, db)
    proteins = _get_proteins_for(exp.id, db)
    return ExperimentDetailResponse.model_validate(
        {**exp.__dict__, "molecules": molecules, "proteins": proteins}
    )


@router.delete(
    "/{experiment_id}/proteins/{protein_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_protein(
    experiment_id: uuid.UUID,
    protein_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    exp = _get_experiment(experiment_id, lab.id, db)

    link = db.execute(
        select(ExperimentProtein).where(
            ExperimentProtein.experiment_id == exp.id,
            ExperimentProtein.protein_id == protein_id,
        )
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protein not attached to this experiment",
        )

    prot = db.get(Protein, protein_id)
    exp_title = exp.title
    exp_id = exp.id
    prot_name = prot.name if prot else str(protein_id)

    db.delete(link)
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="DELETE",
        entity_type="EXPERIMENT_PROTEIN",
        entity_id=exp_id,
        entity_name=f"{exp_title} ← {prot_name}",
        detail=f"Detached protein '{prot_name}' from experiment '{exp_title}'",
    )


@router.delete("/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    experiment_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    exp = _get_experiment(experiment_id, lab.id, db)

    member = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab.id,
            LabMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    role = member.role if member else MemberRole.STUDENT

    if exp.created_by_user_id != current_user.id and role != MemberRole.PI:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator or a PI can delete this experiment",
        )

    exp_id = exp.id
    exp_title = exp.title

    # Find all members who had molecules in this experiment (before deletion)
    linked_mols = _get_molecules_for(exp.id, db)
    affected_user_ids: set[uuid.UUID] = set()
    for mol in linked_mols:
        if mol.created_by_user_id and mol.created_by_user_id != current_user.id:
            affected_user_ids.add(mol.created_by_user_id)

    db.delete(exp)
    db.commit()
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="DELETE",
        entity_type="EXPERIMENT",
        entity_id=exp_id,
        entity_name=exp_title,
    )
    # Notify affected members
    for uid in affected_user_ids:
        notify(
            db,
            user_id=uid,
            lab_id=lab.id,
            type="experiment_deleted",
            title="Experiment deleted",
            message=f"Experiment '{exp_title}' (which contained your molecule(s)) was deleted by {current_user.email}.",
        )

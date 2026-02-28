import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.experiment import Experiment
from app.models.experiment_molecule import ExperimentMolecule
from app.models.lab import Lab
from app.models.molecule import Molecule
from app.models.user import User
from app.schemas.experiment import (
    CreateExperimentRequest,
    ExperimentDetailResponse,
    ExperimentResponse,
)

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
    return ExperimentDetailResponse.model_validate(
        {**exp.__dict__, "molecules": molecules}
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

    molecules = _get_molecules_for(exp.id, db)
    return ExperimentDetailResponse.model_validate(
        {**exp.__dict__, "molecules": molecules}
    )


@router.delete(
    "/{experiment_id}/molecules/{molecule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_molecule(
    experiment_id: uuid.UUID,
    molecule_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
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

    db.delete(link)
    db.commit()


@router.delete("/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    experiment_id: uuid.UUID,
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> None:
    exp = _get_experiment(experiment_id, lab.id, db)
    db.delete(exp)
    db.commit()

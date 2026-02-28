from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member
from app.models.lab import Lab
from app.models.lab_member import LabMember
from app.models.user import User
from app.schemas.lab import CreateLabRequest, JoinLabRequest, LabResponse
from app.services.lab import (
    AlreadyMemberError,
    InvalidLabPasswordError,
    LabNotFoundError,
    create_lab,
    join_lab,
)

router = APIRouter(prefix="/api/v1/labs", tags=["labs"])


@router.post("/", response_model=LabResponse, status_code=status.HTTP_201_CREATED)
def create(
    body: CreateLabRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Lab:
    return create_lab(db, name=body.name, password=body.password, creator=current_user)


@router.post("/join", response_model=LabResponse)
def join(
    body: JoinLabRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Lab:
    try:
        return join_lab(db, lab_code=body.lab_code, password=body.password, user=current_user)
    except LabNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")
    except InvalidLabPasswordError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid lab password")
    except AlreadyMemberError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member of this lab")


@router.get("/", response_model=list[LabResponse])
def list_my_labs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Lab]:
    rows = db.execute(
        select(Lab)
        .join(LabMember, Lab.id == LabMember.lab_id)
        .where(LabMember.user_id == current_user.id)
        .order_by(Lab.created_at.desc())
    ).scalars().all()
    return list(rows)


@router.get("/{lab_id}", response_model=LabResponse)
def get_one(lab: Lab = Depends(get_lab_member)) -> Lab:
    return lab

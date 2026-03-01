import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member, require_pi
from app.models.lab import Lab
from app.models.lab_member import LabMember
from app.models.user import User
from app.schemas.lab import (
    CreateLabRequest,
    JoinLabRequest,
    LabDetailResponse,
    LabResponse,
    MemberResponse,
    UpdateMemberRoleRequest,
)
from app.services.audit import log_action
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
        lab = join_lab(db, lab_code=body.lab_code, password=body.password, user=current_user)
    except LabNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")
    except InvalidLabPasswordError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid lab password")
    except AlreadyMemberError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member of this lab")
    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="LAB_MEMBER",
        entity_id=current_user.id,
        entity_name=current_user.email,
        detail=f"Joined lab '{lab.name}' ({lab.lab_code})",
    )
    return lab


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


@router.get("/{lab_id}", response_model=LabDetailResponse)
def get_one(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> LabDetailResponse:
    rows = db.execute(
        select(LabMember, User)
        .join(User, LabMember.user_id == User.id)
        .where(LabMember.lab_id == lab.id)
        .order_by(LabMember.joined_at.asc())
    ).all()

    members = [
        MemberResponse(
            user_id=member.user_id,
            email=user.email,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]

    return LabDetailResponse(
        id=lab.id,
        name=lab.name,
        lab_code=lab.lab_code,
        created_by_user_id=lab.created_by_user_id,
        created_at=lab.created_at,
        members=members,
    )


@router.patch("/{lab_id}/members/{user_id}/role", response_model=MemberResponse)
def update_member_role(
    lab_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateMemberRoleRequest,
    caller: LabMember = Depends(require_pi),
    db: Session = Depends(get_db),
) -> MemberResponse:
    target = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == user_id,
        )
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    target.role = body.role
    db.commit()
    db.refresh(target)

    user = db.get(User, target.user_id)
    log_action(
        db,
        lab_id=lab_id,
        user_id=caller.user_id,
        action="UPDATE",
        entity_type="LAB_MEMBER",
        entity_id=target.user_id,
        entity_name=user.email,
        detail=f"Role changed to {body.role}",
    )
    return MemberResponse(
        user_id=target.user_id,
        email=user.email,
        role=target.role,
        joined_at=target.joined_at,
    )

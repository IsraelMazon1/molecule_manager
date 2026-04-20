import uuid

import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.deps.lab import get_lab_member, require_pi
from app.models.lab import Lab
from app.models.audit_log import AuditLog
from app.models.lab_member import LabMember, MemberRole
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
from app.services.export_excel import export_lab_workbook
from app.services.notifications import notify
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
    # Notify all PIs that someone joined
    pis = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab.id,
            LabMember.role == MemberRole.PI,
        )
    ).scalars().all()
    for pi in pis:
        notify(
            db,
            user_id=pi.user_id,
            lab_id=lab.id,
            type="member_joined",
            title="New lab member",
            message=f"{current_user.email} has joined your lab '{lab.name}'.",
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


@router.get("/{lab_id}/export")
def export_lab(
    lab: Lab = Depends(get_lab_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export all lab data as a multi-sheet .xlsx workbook."""
    workbook_bytes = export_lab_workbook(lab.id, db)

    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in lab.name)
    filename = f"{safe_name}_export_{date.today().isoformat()}.xlsx"

    log_action(
        db,
        lab_id=lab.id,
        user_id=current_user.id,
        action="CREATE",
        entity_type="MOLECULE",
        entity_id=current_user.id,
        entity_name="Lab export",
        detail="Exported lab data to spreadsheet",
    )

    return StreamingResponse(
        io.BytesIO(workbook_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{lab_id}/members", response_model=list[MemberResponse])
def list_members(
    lab: Lab = Depends(get_lab_member),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    rows = db.execute(
        select(LabMember, User)
        .join(User, LabMember.user_id == User.id)
        .where(LabMember.lab_id == lab.id)
        .order_by(LabMember.joined_at.asc())
    ).all()

    return [
        MemberResponse(
            user_id=member.user_id,
            email=user.email,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]


def _count_pis(db: Session, lab_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).where(
            LabMember.lab_id == lab_id,
            LabMember.role == MemberRole.PI,
        )
    ).scalar_one()


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

    if caller.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role — another PI must do this",
        )

    # Demoting a PI: ensure at least one PI remains
    if target.role == MemberRole.PI and body.role == "STUDENT":
        if _count_pis(db, lab_id) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote — lab must have at least one PI",
            )

    target_user = db.get(User, target.user_id)
    target.role = body.role

    db.add(AuditLog(
        lab_id=lab_id,
        user_id=caller.user_id,
        action="UPDATE",
        entity_type="LAB_MEMBER",
        entity_id=target.user_id,
        entity_name=target_user.email,
        detail=f"Role changed to {body.role}",
    ))
    db.commit()
    db.refresh(target)

    # Notify the affected user about their role change
    lab = db.get(Lab, lab_id)
    lab_name = lab.name if lab else "your lab"
    notify(
        db,
        user_id=target.user_id,
        lab_id=lab_id,
        type="role_changed",
        title="Your role has changed",
        message=f"Your role in '{lab_name}' has been changed to {body.role}.",
    )

    return MemberResponse(
        user_id=target.user_id,
        email=target_user.email,
        role=target.role,
        joined_at=target.joined_at,
    )


@router.delete("/{lab_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    lab_id: uuid.UUID,
    user_id: uuid.UUID,
    caller: LabMember = Depends(require_pi),
    db: Session = Depends(get_db),
) -> None:
    target = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == user_id,
        )
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if caller.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself — another PI must do this",
        )

    # Removing a PI: ensure at least one PI remains
    if target.role == MemberRole.PI:
        if _count_pis(db, lab_id) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove — lab must have at least one PI",
            )

    target_user = db.get(User, target.user_id)
    db.delete(target)

    db.add(AuditLog(
        lab_id=lab_id,
        user_id=caller.user_id,
        action="DELETE",
        entity_type="LAB_MEMBER",
        entity_id=user_id,
        entity_name=target_user.email,
        detail=f"Removed from lab",
    ))
    db.commit()

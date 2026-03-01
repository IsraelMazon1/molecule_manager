import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.user import User


def get_lab_member(
    lab_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Lab:
    """Verify the current user is a member of lab_id and return the Lab.

    Raises 404 if the lab doesn't exist, 403 if the user is not a member.
    Intended as a reusable dependency for all lab-scoped routes (molecules,
    experiments, etc.) that carry {lab_id} in their path.
    """
    lab = db.get(Lab, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")

    member = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this lab")

    return lab


def get_current_member(
    lab_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabMember:
    """Return the LabMember row for the current user in lab_id.

    Raises 404 if the lab doesn't exist, 403 if the user is not a member.
    """
    lab = db.get(Lab, lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")

    member = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab_id,
            LabMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this lab")

    return member


def require_pi(
    lab_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabMember:
    """Raise 403 unless the current user is a PI in lab_id."""
    member = get_current_member(lab_id=lab_id, db=db, current_user=current_user)
    if member.role != MemberRole.PI:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PI role required")
    return member

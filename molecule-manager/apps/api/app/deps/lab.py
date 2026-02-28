import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.models.lab import Lab
from app.models.lab_member import LabMember
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

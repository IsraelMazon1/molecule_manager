import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.lab import Lab
from app.models.lab_member import LabMember, MemberRole
from app.models.user import User

# ---------------------------------------------------------------------------
# Custom exceptions — translated to HTTP errors in the router layer
# ---------------------------------------------------------------------------


class LabNotFoundError(Exception):
    pass


class InvalidLabPasswordError(Exception):
    pass


class AlreadyMemberError(Exception):
    pass


# ---------------------------------------------------------------------------
# Lab-code generation
# ---------------------------------------------------------------------------

_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LENGTH = 8


def _random_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LENGTH))


def generate_unique_lab_code(db: Session) -> str:
    for _ in range(10):
        code = _random_code()
        if not db.execute(select(Lab).where(Lab.lab_code == code)).scalar_one_or_none():
            return code
    raise RuntimeError("Failed to generate a unique lab code after 10 attempts")


# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------


def create_lab(db: Session, name: str, password: str, creator: User) -> Lab:
    lab = Lab(
        name=name,
        lab_code=generate_unique_lab_code(db),
        hashed_password=hash_password(password),
        created_by_user_id=creator.id,
    )
    db.add(lab)
    db.flush()  # populate lab.id before inserting the membership row

    db.add(LabMember(lab_id=lab.id, user_id=creator.id, role=MemberRole.PI))
    db.commit()
    db.refresh(lab)
    return lab


def join_lab(db: Session, lab_code: str, password: str, user: User) -> Lab:
    lab = db.execute(
        select(Lab).where(Lab.lab_code == lab_code)
    ).scalar_one_or_none()

    if not lab:
        raise LabNotFoundError(lab_code)

    if not verify_password(password, lab.hashed_password):
        raise InvalidLabPasswordError

    already = db.execute(
        select(LabMember).where(
            LabMember.lab_id == lab.id,
            LabMember.user_id == user.id,
        )
    ).scalar_one_or_none()

    if already:
        raise AlreadyMemberError

    db.add(LabMember(lab_id=lab.id, user_id=user.id))
    db.commit()
    return lab

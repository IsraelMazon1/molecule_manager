import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SQLAlchemyEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MemberRole(str, enum.Enum):
    PI = "PI"
    STUDENT = "STUDENT"


class LabMember(Base):
    __tablename__ = "lab_members"
    __table_args__ = (UniqueConstraint("lab_id", "user_id", name="uq_lab_members_lab_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lab_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("labs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    role: Mapped[MemberRole] = mapped_column(
        SQLAlchemyEnum(MemberRole, name="member_role", create_constraint=False),
        nullable=False,
        default=MemberRole.STUDENT,
    )

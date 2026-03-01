import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    *,
    lab_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    entity_name: str | None = None,
    detail: str | None = None,
) -> None:
    """Persist one audit log entry in its own commit.

    Called after the business transaction has already committed, so a logging
    failure cannot roll back the data-change that triggered it.
    """
    entry = AuditLog(
        lab_id=lab_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        detail=detail,
    )
    db.add(entry)
    db.commit()

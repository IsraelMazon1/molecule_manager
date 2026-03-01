import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps.db import get_db
from app.deps.lab import require_pi
from app.models.audit_log import AuditLog
from app.models.lab_member import LabMember
from app.schemas.lab import AuditLogPageResponse, AuditLogResponse

router = APIRouter(prefix="/api/v1/labs", tags=["audit"])


@router.get("/{lab_id}/audit", response_model=AuditLogPageResponse)
def get_audit_log(
    lab_id: uuid.UUID,
    caller: LabMember = Depends(require_pi),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AuditLogPageResponse:
    base_stmt = select(AuditLog).where(AuditLog.lab_id == lab_id)

    total: int = db.execute(
        select(func.count()).select_from(base_stmt.subquery())
    ).scalar_one()

    rows = list(
        db.execute(
            base_stmt.order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).scalars().all()
    )

    return AuditLogPageResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=[AuditLogResponse.model_validate(r) for r in rows],
    )

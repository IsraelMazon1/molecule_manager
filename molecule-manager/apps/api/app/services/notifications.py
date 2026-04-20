"""Notification service — creates in-app notifications and optionally sends emails."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lab import Lab
from app.models.notification import Notification
from app.models.user import User
from app.services.email import send_notification_email

logger = logging.getLogger(__name__)


def notify(
    db: Session,
    *,
    user_id: uuid.UUID,
    lab_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    send_email: bool = True,
) -> Notification:
    """Create an in-app notification and optionally send an email."""
    notif = Notification(
        user_id=user_id,
        lab_id=lab_id,
        type=type,
        title=title,
        message=message,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    if send_email:
        user = db.get(User, user_id)
        lab = db.get(Lab, lab_id)
        if user:
            send_notification_email(
                to=user.email,
                title=title,
                message=message,
                lab_name=lab.name if lab else None,
            )

    return notif

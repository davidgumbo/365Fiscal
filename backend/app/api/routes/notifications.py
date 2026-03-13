from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    link_url: str
    notification_type: str
    is_read: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class NotificationSummary(BaseModel):
    unread_count: int
    items: list[NotificationRead]


@router.get("", response_model=NotificationSummary)
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc(), Notification.id.desc())
        .limit(20)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .count()
    )
    return {"unread_count": unread_count, "items": rows}


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    )
    rows.update(
        {
            Notification.is_read: True,
            Notification.updated_at: datetime.now(timezone.utc),
        },
        synchronize_session=False,
    )
    db.commit()
    return {"status": "ok"}

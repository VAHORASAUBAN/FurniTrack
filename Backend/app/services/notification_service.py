"""Shared activity feed — every staff user sees what every other staff user
just did (posted, paid, confirmed, cancelled...), not just their own
actions. `notify()` is called from inside the same service functions that
already do the real work, so the row is written in the same transaction
and commits (or rolls back) together with whatever it's describing - no
separate write, no chance of a notification for an action that didn't
actually happen.
"""
from sqlalchemy.orm import Session

from app.models import Notification


def notify(db: Session, message: str, *, link: str | None = None, actor_user_id: int | None = None) -> None:
    db.add(Notification(message=message, link=link, created_by_user_id=actor_user_id))
    db.flush()


def list_recent(db: Session, limit: int = 30) -> list[Notification]:
    return (
        db.query(Notification)
        .order_by(Notification.id.desc())
        .limit(limit)
        .all()
    )

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.quotation import Quotation


def next_quotation_reference(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"Q-{today}-"
    count = db.query(Quotation).filter(Quotation.reference.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"
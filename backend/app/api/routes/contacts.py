from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access, require_portal_user
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.post("", response_model=ContactRead)
def create_contact(
    payload: ContactCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, payload.company_id)
    contact = Contact(**payload.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("", response_model=list[ContactRead])
def list_contacts(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
    _=Depends(require_company_access),
):
    return db.query(Contact).filter(Contact.company_id == company_id).all()


@router.patch("/{contact_id}", response_model=ContactRead)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return None
    ensure_company_access(db, user, contact.company_id)
    updates = payload.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{contact_id}", response_model=ContactRead)
def replace_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """
    Full update using PUT. Accepts the same fields as ContactUpdate
    and applies provided values to the contact record.
    """
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return None
    ensure_company_access(db, user, contact.company_id)
    updates = payload.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact

import csv
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access, require_portal_user
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


class BatchContactIds(BaseModel):
    ids: List[int]


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


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Delete a single contact."""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    ensure_company_access(db, user, contact.company_id)
    db.delete(contact)
    db.commit()
    return None


@router.post("/batch-delete")
def batch_delete_contacts(
    payload: BatchContactIds,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Delete multiple contacts by IDs."""
    contacts = db.query(Contact).filter(Contact.id.in_(payload.ids)).all()
    if not contacts:
        raise HTTPException(status_code=404, detail="No contacts found")
    for contact in contacts:
        ensure_company_access(db, user, contact.company_id)
    for contact in contacts:
        db.delete(contact)
    db.commit()
    return {"deleted": len(contacts)}


@router.post("/export-csv")
def export_contacts_csv(
    payload: BatchContactIds,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Export selected contacts as CSV."""
    contacts = db.query(Contact).filter(Contact.id.in_(payload.ids)).all()
    if not contacts:
        raise HTTPException(status_code=404, detail="No contacts found")
    for contact in contacts:
        ensure_company_access(db, user, contact.company_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "VAT", "TIN", "Phone", "Email", "Address", "Reference"])
    for c in contacts:
        writer.writerow([c.name, c.vat, c.tin, c.phone, c.email or "", c.address, c.reference])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts_export.csv"},
    )

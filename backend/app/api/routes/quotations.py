from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access, require_portal_user
from app.models.quotation import Quotation
from app.models.quotation_line import QuotationLine
from app.schemas.quotation import QuotationCreate, QuotationRead, QuotationUpdate
from app.services.sequence import next_quotation_reference

router = APIRouter(prefix="/quotations", tags=["quotations"])


def calculate_line_total(line_data: dict) -> float:
    """Calculate total price for a quotation line including VAT."""
    quantity = line_data.get("quantity", 1)
    unit_price = line_data.get("unit_price", 0)
    vat_rate = line_data.get("vat_rate", 0)
    discount = line_data.get("discount", 0)
    
    subtotal = quantity * unit_price * (1 - discount / 100)
    total = subtotal * (1 + vat_rate / 100)
    return total


@router.post("", response_model=QuotationRead)
def create_quotation(
    payload: QuotationCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, payload.company_id)
    reference = next_quotation_reference(db)
    quotation = Quotation(
        company_id=payload.company_id,
        customer_id=payload.customer_id,
        reference=reference,
        expires_at=payload.expires_at,
        payment_terms=payload.payment_terms,
        status="draft",
    )
    db.add(quotation)
    db.flush()

    for line in payload.lines:
        line_dict = line.dict()
        total_price = calculate_line_total(line_dict)
        db.add(
            QuotationLine(
                quotation_id=quotation.id,
                product_id=line.product_id,
                description=line.description,
                quantity=line.quantity,
                uom=line.uom,
                unit_price=line.unit_price,
                vat_rate=line.vat_rate,
                total_price=total_price,
            )
        )

    db.commit()
    db.refresh(quotation)
    return quotation


@router.get("", response_model=list[QuotationRead])
def list_quotations(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
    _=Depends(require_company_access),
    status: str | None = None,
    customer_id: int | None = None,
    search: str | None = None,
):
    query = db.query(Quotation).filter(Quotation.company_id == company_id)
    if status:
        query = query.filter(Quotation.status == status)
    if customer_id:
        query = query.filter(Quotation.customer_id == customer_id)
    if search:
        like = f"%{search}%"
        query = query.filter(Quotation.reference.ilike(like))
    return query.order_by(Quotation.created_at.desc()).all()


@router.get("/{quotation_id}", response_model=QuotationRead)
def get_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    ensure_company_access(db, user, quotation.company_id)
    return quotation


@router.patch("/{quotation_id}", response_model=QuotationRead)
def update_quotation(
    quotation_id: int,
    payload: QuotationUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    ensure_company_access(db, user, quotation.company_id)

    updates = payload.dict(exclude_unset=True)
    lines = updates.pop("lines", None)
    for field, value in updates.items():
        setattr(quotation, field, value)

    if lines is not None:
        db.query(QuotationLine).filter(QuotationLine.quotation_id == quotation.id).delete()
        for line in lines:
            line_dict = line.dict()
            total_price = calculate_line_total(line_dict)
            db.add(
                QuotationLine(
                    quotation_id=quotation.id,
                    product_id=line.product_id,
                    description=line.description,
                    quantity=line.quantity,
                    uom=line.uom,
                    unit_price=line.unit_price,
                    vat_rate=line.vat_rate,
                    total_price=total_price,
                )
            )

    db.commit()
    db.refresh(quotation)
    return quotation


@router.delete("/{quotation_id}")
def delete_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    ensure_company_access(db, user, quotation.company_id)
    
    if quotation.status not in ["draft", "cancelled"]:
        raise HTTPException(status_code=400, detail="Can only delete draft or cancelled quotations")
    
    db.delete(quotation)
    db.commit()
    return {"status": "deleted"}


@router.post("/{quotation_id}/duplicate", response_model=QuotationRead)
def duplicate_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    ensure_company_access(db, user, quotation.company_id)
    
    new_reference = next_quotation_reference(db)
    new_quotation = Quotation(
        company_id=quotation.company_id,
        customer_id=quotation.customer_id,
        reference=new_reference,
        expires_at=quotation.expires_at,
        payment_terms=quotation.payment_terms,
        status="draft",
    )
    db.add(new_quotation)
    db.flush()
    
    for line in quotation.lines:
        db.add(QuotationLine(
            quotation_id=new_quotation.id,
            product_id=line.product_id,
            description=line.description,
            quantity=line.quantity,
            uom=line.uom,
            unit_price=line.unit_price,
            vat_rate=line.vat_rate,
            total_price=line.total_price,
        ))
    
    db.commit()
    db.refresh(new_quotation)
    return new_quotation

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access, require_portal_user
from app.models.invoice import Invoice
from app.models.invoice_line import InvoiceLine
from app.models.quotation import Quotation
from app.models.contact import Contact
from app.schemas.invoice import InvoiceCreate, InvoiceRead, InvoiceUpdate
from app.services.fdms import submit_invoice

router = APIRouter(prefix="/invoices", tags=["invoices"])


def next_invoice_reference(db: Session, prefix: str = "INV") -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    full_prefix = f"{prefix}-{today}-"
    count = db.query(Invoice).filter(Invoice.reference.like(f"{full_prefix}%")).count()
    return f"{full_prefix}{count + 1:04d}"


def calculate_line_amounts(line_data: dict) -> tuple[float, float, float]:
    """Calculate subtotal, tax_amount, and total_price for a line."""
    quantity = line_data.get("quantity", 1)
    unit_price = line_data.get("unit_price", 0)
    discount = line_data.get("discount", 0)
    vat_rate = line_data.get("vat_rate", 0)
    
    subtotal = quantity * unit_price * (1 - discount / 100)
    tax_amount = subtotal * (vat_rate / 100)
    total_price = subtotal + tax_amount
    
    return subtotal, tax_amount, total_price


def recalculate_invoice_totals(invoice: Invoice):
    """Recalculate invoice totals from lines."""
    subtotal = sum(line.subtotal for line in invoice.lines)
    discount_amount = sum(
        line.quantity * line.unit_price * (line.discount / 100) 
        for line in invoice.lines
    )
    tax_amount = sum(line.tax_amount for line in invoice.lines)
    total_amount = sum(line.total_price for line in invoice.lines)
    
    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.tax_amount = tax_amount
    invoice.total_amount = total_amount
    invoice.amount_due = total_amount - invoice.amount_paid


@router.post("", response_model=InvoiceRead)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, payload.company_id)
    invoice_type = payload.invoice_type or "invoice"
    prefix = "CN" if invoice_type == "credit_note" else "INV"
    reference = payload.reference or next_invoice_reference(db, prefix=prefix)
    
    # Get customer from quotation if not provided
    customer_id = payload.customer_id
    if not customer_id and payload.quotation_id:
        quotation = db.query(Quotation).filter(Quotation.id == payload.quotation_id).first()
        if quotation:
            customer_id = quotation.customer_id
    
    invoice = Invoice(
        company_id=payload.company_id,
        quotation_id=payload.quotation_id,
        customer_id=customer_id,
        device_id=payload.device_id,
        reference=reference,
        invoice_date=payload.invoice_date or datetime.utcnow(),
        due_date=payload.due_date,
        currency=payload.currency,
        payment_terms=payload.payment_terms,
        notes=payload.notes,
        invoice_type=invoice_type,
        reversed_invoice_id=payload.reversed_invoice_id,
        status="draft",
    )
    db.add(invoice)
    db.flush()
    
    # Add lines from payload or copy from quotation
    if payload.lines:
        for line_data in payload.lines:
            subtotal, tax_amount, total_price = calculate_line_amounts(line_data.dict())
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                product_id=line_data.product_id,
                description=line_data.description,
                quantity=line_data.quantity,
                uom=line_data.uom,
                unit_price=line_data.unit_price,
                discount=line_data.discount,
                vat_rate=line_data.vat_rate,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_price=total_price,
            ))
    elif payload.quotation_id:
        quotation = db.query(Quotation).filter(Quotation.id == payload.quotation_id).first()
        if quotation:
            for qline in quotation.lines:
                line_dict = {
                    "quantity": qline.quantity,
                    "unit_price": qline.unit_price,
                    "discount": 0,
                    "vat_rate": qline.vat_rate
                }
                subtotal, tax_amount, total_price = calculate_line_amounts(line_dict)
                db.add(InvoiceLine(
                    invoice_id=invoice.id,
                    product_id=qline.product_id,
                    description=qline.description,
                    quantity=qline.quantity,
                    uom=qline.uom,
                    unit_price=qline.unit_price,
                    discount=0,
                    vat_rate=qline.vat_rate,
                    subtotal=subtotal,
                    tax_amount=tax_amount,
                    total_price=total_price,
                ))
    
    db.flush()
    db.refresh(invoice)
    recalculate_invoice_totals(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/values")
def invoice_values(field: str, company_id: int | None = None, q: str | None = None, db: Session = Depends(get_db)):
    """Return distinct values for invoice fields (e.g., status, reference)."""
    if field == "status":
        query = db.query(Invoice.status).distinct()
        if company_id:
            query = query.filter(Invoice.company_id == company_id)
        if q:
            query = query.filter(Invoice.status.ilike(f"%{q}%"))
        return [r[0] for r in query.order_by(Invoice.status).all() if r[0]]
    if field == "reference":
        query = db.query(Invoice.reference.distinct())
        if company_id:
            query = query.filter(Invoice.company_id == company_id)
        if q:
            query = query.filter(Invoice.reference.ilike(f"%{q}%"))
        return [r[0] for r in query.order_by(Invoice.reference).all() if r[0]]
    return []


@router.get("", response_model=list[InvoiceRead])
def list_invoices(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
    _=Depends(require_company_access),
    search: str | None = None,
    status: str | None = None,
    customer_id: int | None = None,
    invoice_type: str | None = None,
):
    query = db.query(Invoice).filter(Invoice.company_id == company_id)
    if search:
        like = f"%{search}%"
        query = query.filter(Invoice.reference.ilike(like) | Invoice.status.ilike(like))
    if status:
        query = query.filter(Invoice.status == status)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    return query.order_by(Invoice.created_at.desc()).all()


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    return invoice


@router.post("/{invoice_id}/credit-note", response_model=InvoiceRead)
def create_credit_note(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)

    reference = next_invoice_reference(db, prefix="CN")
    credit_note = Invoice(
        company_id=invoice.company_id,
        invoice_type="credit_note",
        reversed_invoice_id=invoice.id,
        quotation_id=None,
        customer_id=invoice.customer_id,
        device_id=invoice.device_id,
        reference=reference,
        invoice_date=datetime.utcnow(),
        due_date=invoice.due_date,
        currency=invoice.currency,
        payment_terms=invoice.payment_terms,
        notes=f"Credit note for {invoice.reference}",
        status="draft",
    )
    db.add(credit_note)
    db.flush()

    for line in invoice.lines:
        line_dict = {
            "quantity": -line.quantity,
            "unit_price": line.unit_price,
            "discount": line.discount,
            "vat_rate": line.vat_rate,
        }
        subtotal, tax_amount, total_price = calculate_line_amounts(line_dict)
        db.add(InvoiceLine(
            invoice_id=credit_note.id,
            product_id=line.product_id,
            description=line.description,
            quantity=-line.quantity,
            uom=line.uom,
            unit_price=line.unit_price,
            discount=line.discount,
            vat_rate=line.vat_rate,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_price=total_price,
        ))

    db.flush()
    db.refresh(credit_note)
    recalculate_invoice_totals(credit_note)
    db.commit()
    db.refresh(credit_note)
    return credit_note


@router.patch("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    
    if invoice.status not in ["draft"]:
        raise HTTPException(status_code=400, detail="Can only edit draft invoices")
    
    updates = payload.dict(exclude_unset=True)
    lines = updates.pop("lines", None)
    
    for field, value in updates.items():
        setattr(invoice, field, value)
    
    if lines is not None:
        db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice.id).delete()
        for line_data in lines:
            subtotal, tax_amount, total_price = calculate_line_amounts(line_data.dict())
            db.add(InvoiceLine(
                invoice_id=invoice.id,
                product_id=line_data.product_id,
                description=line_data.description,
                quantity=line_data.quantity,
                uom=line_data.uom,
                unit_price=line_data.unit_price,
                discount=line_data.discount,
                vat_rate=line_data.vat_rate,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_price=total_price,
            ))
        db.flush()
        db.refresh(invoice)
        recalculate_invoice_totals(invoice)
    
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/post", response_model=InvoiceRead)
def post_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    
    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Can only post draft invoices")
    
    if not invoice.lines:
        raise HTTPException(status_code=400, detail="Cannot post invoice without lines")
    
    invoice.status = "posted"
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/reset", response_model=InvoiceRead)
def reset_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    
    if invoice.zimra_status == "submitted":
        raise HTTPException(status_code=400, detail="Cannot reset fiscalized invoice")
    
    invoice.status = "draft"
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/pay", response_model=InvoiceRead)
def register_payment(
    invoice_id: int,
    amount: float,
    payment_reference: str = "",
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    
    if invoice.status == "draft":
        raise HTTPException(status_code=400, detail="Cannot pay draft invoice")
    
    invoice.amount_paid += amount
    invoice.amount_due = invoice.total_amount - invoice.amount_paid
    invoice.payment_reference = payment_reference
    
    if invoice.amount_due <= 0:
        invoice.status = "paid"
    
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/fiscalize", response_model=InvoiceRead)
def fiscalize_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_company_access(db, user, invoice.company_id)
    
    if invoice.status not in ["posted", "paid"]:
        raise HTTPException(status_code=400, detail="Can only fiscalize posted or paid invoices")
    
    try:
        submit_invoice(invoice, db)
        invoice.status = "fiscalized"
        invoice.fiscalized_at = datetime.utcnow()
        db.commit()
        db.refresh(invoice)
    except Exception as exc:
        invoice.zimra_status = "error"
        invoice.zimra_errors = str(exc)
        db.commit()
        db.refresh(invoice)
    return invoice

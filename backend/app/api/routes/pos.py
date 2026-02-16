"""POS (Point of Sale) API routes.

Provides endpoints for:
- POS session management (open / close)
- POS order creation with inline payment + optional auto-fiscalize
- Order listing, detail, refund, receipt reprinting
- Quick product search optimised for barcode / name lookup
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_db, get_current_user, ensure_company_access, require_portal_user,
    log_audit, check_permission,
)
from sqlalchemy import func
from app.models.pos_session import POSSession, POSOrder, POSOrderLine
from app.models.invoice import Invoice
from app.models.invoice_line import InvoiceLine
from app.models.product import Product
from app.models.device import Device
from app.models.contact import Contact
from app.models.tax_setting import TaxSetting
from app.models.category import Category
from app.models.company import Company
from app.models.company_settings import CompanySettings
from app.models.stock_quant import StockQuant
from app.models.stock_move import StockMove
from app.models.audit_log import AuditAction, ResourceType
from app.models.pos_employee import POSEmployee
from app.schemas.pos import (
    POSSessionOpen, POSSessionClose, POSSessionRead, POSSessionSummary,
    POSOrderCreate, POSOrderRead, POSOrderRefund,
    POSEmployeeCreate, POSEmployeeUpdate, POSEmployeeRead,
)
from app.services.fdms import submit_invoice

router = APIRouter(prefix="/pos", tags=["pos"])


# ── helpers ─────────────────────────────────────────────────────────────────

def _next_session_name(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"POS-{today}-"
    count = db.query(POSSession).filter(POSSession.name.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


def _next_order_ref(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"POS-ORD-{today}-"
    count = db.query(POSOrder).filter(POSOrder.reference.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


def _next_invoice_ref(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"POS-INV-{today}-"
    count = db.query(Invoice).filter(Invoice.reference.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


def _calc_line(data: dict) -> tuple[float, float, float]:
    qty = data.get("quantity", 1)
    price = data.get("unit_price", 0)
    disc = data.get("discount", 0)
    vat = data.get("vat_rate", 0)
    subtotal = qty * price * (1 - disc / 100)
    tax = subtotal * (vat / 100)
    return round(subtotal, 2), round(tax, 2), round(subtotal + tax, 2)


# ── sessions ────────────────────────────────────────────────────────────────

@router.post("/sessions/open", response_model=POSSessionRead)
def open_session(
    payload: POSSessionOpen,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Open a new POS session (cash register)."""
    ensure_company_access(db, user, payload.company_id)

    # Only one open session per user per company
    existing = (
        db.query(POSSession)
        .filter(
            POSSession.company_id == payload.company_id,
            POSSession.opened_by_id == user.id,
            POSSession.status == "open",
        )
        .first()
    )
    if existing:
        return existing  # return current open session

    session = POSSession(
        company_id=payload.company_id,
        device_id=payload.device_id,
        opened_by_id=user.id,
        name=_next_session_name(db),
        opening_balance=payload.opening_balance,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    log_audit(
        db=db, user=user,
        action="pos_session_open",
        resource_type="pos_session",
        resource_id=session.id,
        resource_reference=session.name,
        company_id=payload.company_id,
        changes_summary=f"POS session {session.name} opened",
    )
    db.commit()
    return session


@router.post("/sessions/{session_id}/close", response_model=POSSessionSummary)
def close_session(
    session_id: int,
    payload: POSSessionClose,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Close a POS session and produce summary."""
    session = db.query(POSSession).filter(POSSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    ensure_company_access(db, user, session.company_id)
    if session.status != "open":
        raise HTTPException(400, "Session is already closed")

    session.status = "closed"
    session.closed_at = datetime.utcnow()
    session.closed_by_id = user.id
    session.closing_balance = payload.closing_balance
    if payload.notes:
        session.notes = f"{session.notes}\n{payload.notes}" if session.notes else payload.notes

    orders = db.query(POSOrder).filter(POSOrder.session_id == session_id).all()
    expected_cash = session.opening_balance + session.total_cash - session.total_returns
    difference = (payload.closing_balance or 0) - expected_cash

    log_audit(
        db=db, user=user,
        action="pos_session_close",
        resource_type="pos_session",
        resource_id=session.id,
        resource_reference=session.name,
        company_id=session.company_id,
        new_values={"closing_balance": payload.closing_balance, "difference": difference},
        changes_summary=f"POS session {session.name} closed",
    )
    db.commit()
    db.refresh(session)

    order_reads = []
    for o in orders:
        db.refresh(o)
        order_reads.append(POSOrderRead.model_validate(o))

    return POSSessionSummary(
        session=POSSessionRead.model_validate(session),
        orders=order_reads,
        expected_cash=round(expected_cash, 2),
        difference=round(difference, 2),
    )


@router.get("/sessions", response_model=List[POSSessionRead])
def list_sessions(
    company_id: int,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, company_id)
    q = db.query(POSSession).filter(POSSession.company_id == company_id)
    if status:
        q = q.filter(POSSession.status == status)
    return q.order_by(POSSession.opened_at.desc()).offset(offset).limit(limit).all()


@router.get("/sessions/{session_id}", response_model=POSSessionSummary)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    session = db.query(POSSession).filter(POSSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    ensure_company_access(db, user, session.company_id)

    orders = (
        db.query(POSOrder)
        .options(joinedload(POSOrder.lines))
        .filter(POSOrder.session_id == session_id)
        .order_by(POSOrder.order_date.desc())
        .all()
    )
    expected_cash = session.opening_balance + session.total_cash - session.total_returns
    difference = (session.closing_balance or 0) - expected_cash if session.closing_balance is not None else 0

    return POSSessionSummary(
        session=POSSessionRead.model_validate(session),
        orders=[POSOrderRead.model_validate(o) for o in orders],
        expected_cash=round(expected_cash, 2),
        difference=round(difference, 2),
    )


# ── orders ──────────────────────────────────────────────────────────────────

@router.post("/orders", response_model=POSOrderRead)
def create_order(
    payload: POSOrderCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Create a POS order, record payment, optionally fiscalize via ZIMRA.

    This is the main POS endpoint – it creates the order, creates a
    backing invoice (for fiscal trail), processes payment, and optionally
    submits to ZIMRA in one call.
    """
    ensure_company_access(db, user, payload.company_id)

    # Validate session
    session = db.query(POSSession).filter(POSSession.id == payload.session_id).first()
    if not session or session.status != "open":
        raise HTTPException(400, "POS session is not open")
    if session.company_id != payload.company_id:
        raise HTTPException(400, "Session does not belong to this company")

    if not payload.lines:
        raise HTTPException(400, "Order must have at least one line")

    # Get device from session
    device = None
    if session.device_id:
        device = db.query(Device).filter(Device.id == session.device_id).first()

    # Create POS order
    ref = _next_order_ref(db)
    order = POSOrder(
        session_id=session.id,
        company_id=payload.company_id,
        customer_id=payload.customer_id,
        created_by_id=user.id,
        reference=ref,
        currency=payload.currency,
        payment_method=payload.payment_method,
        cash_amount=payload.cash_amount,
        card_amount=payload.card_amount,
        mobile_amount=payload.mobile_amount,
        payment_reference=payload.payment_reference,
        notes=payload.notes,
        status="draft",
    )
    db.add(order)
    db.flush()

    # Add lines
    subtotal_sum = 0.0
    discount_sum = 0.0
    tax_sum = 0.0
    total_sum = 0.0

    for ld in payload.lines:
        line_dict = ld.model_dump()

        # Auto-fill product info
        if ld.product_id:
            product = db.query(Product).filter(Product.id == ld.product_id).first()
            if product:
                if not ld.description:
                    line_dict["description"] = product.name
                if ld.unit_price == 0:
                    line_dict["unit_price"] = product.sale_price
                if not ld.uom:
                    line_dict["uom"] = product.uom or "Units"
                # Get VAT from product's tax setting
                if ld.vat_rate == 0 and product.tax_id:
                    tax = db.query(TaxSetting).filter(TaxSetting.id == product.tax_id).first()
                    if tax:
                        line_dict["vat_rate"] = tax.rate

        sub, tax, total = _calc_line(line_dict)
        disc = line_dict.get("quantity", 1) * line_dict.get("unit_price", 0) * (line_dict.get("discount", 0) / 100)

        ol = POSOrderLine(
            order_id=order.id,
            product_id=ld.product_id,
            description=line_dict.get("description", ""),
            quantity=line_dict.get("quantity", 1),
            uom=line_dict.get("uom", "Units"),
            unit_price=line_dict.get("unit_price", 0),
            discount=line_dict.get("discount", 0),
            vat_rate=line_dict.get("vat_rate", 0),
            subtotal=sub,
            tax_amount=tax,
            total_price=total,
        )
        db.add(ol)
        subtotal_sum += sub
        discount_sum += disc
        tax_sum += tax
        total_sum += total

    order.subtotal = round(subtotal_sum, 2)
    order.discount_amount = round(discount_sum, 2)
    order.tax_amount = round(tax_sum, 2)
    order.total_amount = round(total_sum, 2)

    # Deduct inventory for storable products
    for ld in payload.lines:
        if not ld.product_id:
            continue
        product = db.query(Product).filter(Product.id == ld.product_id).first()
        if not product or product.product_type != "storable" or not product.track_inventory:
            continue
        qty = ld.quantity
        # Update stock quant (reduce available)
        quant = (
            db.query(StockQuant)
            .filter(StockQuant.product_id == product.id, StockQuant.company_id == payload.company_id)
            .first()
        )
        if quant:
            quant.quantity = round(quant.quantity - qty, 4)
            quant.available_quantity = round(quant.available_quantity - qty, 4)
            quant.total_value = round(quant.quantity * quant.unit_cost, 2)
        # Record stock move
        db.add(StockMove(
            company_id=payload.company_id,
            product_id=product.id,
            reference=ref,
            move_type="out",
            quantity=qty,
            unit_cost=product.sales_cost or product.purchase_cost,
            total_cost=round(qty * (product.sales_cost or product.purchase_cost), 2),
            source_document=ref,
            state="done",
            done_date=datetime.utcnow(),
            notes=f"POS sale: {ref}",
        ))
        db.flush()

    # Calculate change
    paid = payload.cash_amount + payload.card_amount + payload.mobile_amount
    if paid < order.total_amount:
        raise HTTPException(400, f"Insufficient payment: {paid:.2f} < {order.total_amount:.2f}")
    order.change_amount = round(paid - order.total_amount, 2)
    order.status = "paid"

    # Update session totals
    session.total_sales = round((session.total_sales or 0) + order.total_amount, 2)
    session.total_cash = round((session.total_cash or 0) + payload.cash_amount, 2)
    session.total_card = round((session.total_card or 0) + payload.card_amount, 2)
    session.total_mobile = round((session.total_mobile or 0) + payload.mobile_amount, 2)
    session.transaction_count = (session.transaction_count or 0) + 1

    # Create backing Invoice for fiscal trail
    inv_ref = _next_invoice_ref(db)
    invoice = Invoice(
        company_id=payload.company_id,
        customer_id=payload.customer_id,
        device_id=session.device_id,
        reference=inv_ref,
        invoice_type="invoice",
        status="posted",
        invoice_date=datetime.utcnow(),
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
        amount_paid=order.total_amount,
        amount_due=0,
        currency=payload.currency,
        payment_terms="Immediate",
        payment_reference=ref,
        notes=f"POS Order {ref}",
        created_by_id=user.id,
        confirmed_by_id=user.id,
    )
    db.add(invoice)
    db.flush()

    # Copy lines to invoice
    for ld in payload.lines:
        line_dict = ld.model_dump()
        if ld.product_id:
            product = db.query(Product).filter(Product.id == ld.product_id).first()
            if product:
                if not ld.description:
                    line_dict["description"] = product.name
                if ld.unit_price == 0:
                    line_dict["unit_price"] = product.sale_price
                if not ld.uom:
                    line_dict["uom"] = product.uom or "Units"
                if ld.vat_rate == 0 and product.tax_id:
                    tax = db.query(TaxSetting).filter(TaxSetting.id == product.tax_id).first()
                    if tax:
                        line_dict["vat_rate"] = tax.rate

        sub, tax_amt, total = _calc_line(line_dict)
        db.add(InvoiceLine(
            invoice_id=invoice.id,
            product_id=ld.product_id,
            description=line_dict.get("description", ""),
            quantity=line_dict.get("quantity", 1),
            uom=line_dict.get("uom", "Units"),
            unit_price=line_dict.get("unit_price", 0),
            discount=line_dict.get("discount", 0),
            vat_rate=line_dict.get("vat_rate", 0),
            subtotal=sub,
            tax_amount=tax_amt,
            total_price=total,
        ))

    order.invoice_id = invoice.id
    db.flush()

    # Auto-fiscalize
    if payload.auto_fiscalize and device:
        try:
            result = submit_invoice(invoice, db)
            invoice.status = "fiscalized"
            invoice.fiscalized_at = datetime.utcnow()
            invoice.fiscalized_by_id = user.id
            order.is_fiscalized = True
            order.status = "fiscalized"
            order.zimra_receipt_id = invoice.zimra_receipt_id
            order.zimra_verification_code = invoice.zimra_verification_code
            order.zimra_verification_url = invoice.zimra_verification_url
        except Exception as exc:
            order.fiscal_errors = str(exc)
            invoice.zimra_status = "error"
            invoice.zimra_errors = str(exc)

    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[POSOrderRead])
def list_orders(
    company_id: int,
    session_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    ensure_company_access(db, user, company_id)
    q = (
        db.query(POSOrder)
        .options(joinedload(POSOrder.lines))
        .filter(POSOrder.company_id == company_id)
    )
    if session_id:
        q = q.filter(POSOrder.session_id == session_id)
    if status:
        q = q.filter(POSOrder.status == status)
    return q.order_by(POSOrder.order_date.desc()).offset(offset).limit(limit).all()


@router.get("/orders/{order_id}", response_model=POSOrderRead)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    order = (
        db.query(POSOrder)
        .options(joinedload(POSOrder.lines))
        .filter(POSOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found")
    ensure_company_access(db, user, order.company_id)
    return order


@router.post("/orders/{order_id}/fiscalize", response_model=POSOrderRead)
def fiscalize_order(
    order_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Fiscalize a paid POS order that wasn't fiscalized at sale time."""
    order = db.query(POSOrder).filter(POSOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    ensure_company_access(db, user, order.company_id)

    if order.is_fiscalized:
        raise HTTPException(400, "Order already fiscalized")
    if order.status not in ("paid",):
        raise HTTPException(400, "Can only fiscalize paid orders")
    if not order.invoice_id:
        raise HTTPException(400, "Order has no backing invoice")

    invoice = db.query(Invoice).filter(Invoice.id == order.invoice_id).first()
    if not invoice:
        raise HTTPException(400, "Backing invoice not found")
    if not invoice.device_id:
        raise HTTPException(400, "No fiscal device assigned. Assign a device in settings.")

    try:
        submit_invoice(invoice, db)
        invoice.status = "fiscalized"
        invoice.fiscalized_at = datetime.utcnow()
        invoice.fiscalized_by_id = user.id
        order.is_fiscalized = True
        order.status = "fiscalized"
        order.zimra_receipt_id = invoice.zimra_receipt_id
        order.zimra_verification_code = invoice.zimra_verification_code
        order.zimra_verification_url = invoice.zimra_verification_url
        order.fiscal_errors = ""

        log_audit(
            db=db, user=user,
            action="pos_order_fiscalize",
            resource_type="pos_order",
            resource_id=order.id,
            resource_reference=order.reference,
            company_id=order.company_id,
            changes_summary=f"POS order {order.reference} fiscalized",
        )
        db.commit()
        db.refresh(order)
    except Exception as exc:
        order.fiscal_errors = str(exc)
        invoice.zimra_status = "error"
        invoice.zimra_errors = str(exc)
        db.commit()
        db.refresh(order)

    return order


@router.post("/orders/{order_id}/refund", response_model=POSOrderRead)
def refund_order(
    order_id: int,
    payload: POSOrderRefund,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Create a refund (credit note) for a POS order."""
    order = db.query(POSOrder).options(joinedload(POSOrder.lines)).filter(POSOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    ensure_company_access(db, user, order.company_id)
    if order.status in ("cancelled", "refunded"):
        raise HTTPException(400, f"Order is already {order.status}")

    session = db.query(POSSession).filter(POSSession.id == order.session_id).first()

    # Create refund order
    refund_ref = _next_order_ref(db)
    refund = POSOrder(
        session_id=order.session_id,
        company_id=order.company_id,
        customer_id=order.customer_id,
        created_by_id=user.id,
        reference=refund_ref,
        currency=order.currency,
        payment_method=order.payment_method,
        cash_amount=-order.cash_amount,
        card_amount=-order.card_amount,
        mobile_amount=-order.mobile_amount,
        subtotal=-order.subtotal,
        discount_amount=-order.discount_amount,
        tax_amount=-order.tax_amount,
        total_amount=-order.total_amount,
        notes=f"Refund of {order.reference}. {payload.reason}",
        status="paid",
    )
    db.add(refund)
    db.flush()

    for line in order.lines:
        db.add(POSOrderLine(
            order_id=refund.id,
            product_id=line.product_id,
            description=line.description,
            quantity=-line.quantity,
            uom=line.uom,
            unit_price=line.unit_price,
            discount=line.discount,
            vat_rate=line.vat_rate,
            subtotal=-line.subtotal,
            tax_amount=-line.tax_amount,
            total_price=-line.total_price,
        ))

    # Create credit note invoice
    cn_ref = f"CN-{refund_ref}"
    cn = Invoice(
        company_id=order.company_id,
        customer_id=order.customer_id,
        device_id=session.device_id if session else None,
        reference=cn_ref,
        invoice_type="credit_note",
        reversed_invoice_id=order.invoice_id,
        status="posted",
        invoice_date=datetime.utcnow(),
        subtotal=-order.subtotal,
        discount_amount=-order.discount_amount,
        tax_amount=-order.tax_amount,
        total_amount=-order.total_amount,
        amount_paid=-order.total_amount,
        amount_due=0,
        currency=order.currency,
        notes=f"POS Refund {refund_ref}. {payload.reason}",
        created_by_id=user.id,
        confirmed_by_id=user.id,
    )
    db.add(cn)
    db.flush()

    for line in order.lines:
        db.add(InvoiceLine(
            invoice_id=cn.id,
            product_id=line.product_id,
            description=line.description,
            quantity=-line.quantity,
            uom=line.uom,
            unit_price=line.unit_price,
            discount=line.discount,
            vat_rate=line.vat_rate,
            subtotal=-line.subtotal,
            tax_amount=-line.tax_amount,
            total_price=-line.total_price,
        ))

    refund.invoice_id = cn.id
    order.status = "refunded"

    # Update session
    if session:
        session.total_returns = round((session.total_returns or 0) + abs(order.total_amount), 2)
        session.transaction_count = (session.transaction_count or 0) + 1

    # Auto-fiscalize credit note if device available
    if session and session.device_id:
        try:
            submit_invoice(cn, db)
            cn.status = "fiscalized"
            cn.fiscalized_at = datetime.utcnow()
            cn.fiscalized_by_id = user.id
            refund.is_fiscalized = True
            refund.status = "fiscalized"
            refund.zimra_receipt_id = cn.zimra_receipt_id
            refund.zimra_verification_code = cn.zimra_verification_code
            refund.zimra_verification_url = cn.zimra_verification_url
        except Exception as exc:
            refund.fiscal_errors = str(exc)

    db.commit()
    db.refresh(refund)
    return refund


# ── product helpers for POS ─────────────────────────────────────────────────

@router.get("/products", response_model=list)
def pos_products(
    company_id: int,
    search: str = "",
    category_id: Optional[int] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Quick product lookup for POS – returns id, name, price, barcode, tax info, category."""
    ensure_company_access(db, user, company_id)
    q = db.query(Product).filter(
        Product.company_id == company_id,
        Product.is_active == True,
        Product.can_be_sold == True,
    )
    if search:
        like = f"%{search}%"
        q = q.filter(
            Product.name.ilike(like)
            | Product.barcode.ilike(like)
            | Product.reference.ilike(like)
        )
    if category_id:
        q = q.filter(Product.category_id == category_id)

    products = q.order_by(Product.name).limit(limit).all()

    # Batch load stock quantities
    product_ids = [p.id for p in products]
    stock_map: dict[int, float] = {}
    if product_ids:
        quants = (
            db.query(StockQuant.product_id, func.sum(StockQuant.available_quantity))
            .filter(StockQuant.product_id.in_(product_ids), StockQuant.company_id == company_id)
            .group_by(StockQuant.product_id)
            .all()
        )
        stock_map = {pid: qty for pid, qty in quants}

    result = []
    for p in products:
        vat_rate = p.tax_rate or 0
        if p.tax_id:
            tax = db.query(TaxSetting).filter(TaxSetting.id == p.tax_id).first()
            if tax:
                vat_rate = tax.rate
        result.append({
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "reference": p.reference,
            "sale_price": p.sale_price,
            "vat_rate": vat_rate,
            "uom": p.uom,
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else "",
            "description": p.description,
            "image_url": p.image_url or "",
            "stock_on_hand": round(stock_map.get(p.id, 0), 2),
            "track_inventory": p.track_inventory,
            "product_type": p.product_type,
        })
    return result


@router.get("/categories")
def pos_categories(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """List product categories for POS filter."""
    ensure_company_access(db, user, company_id)
    cats = db.query(Category).filter(Category.company_id == company_id).order_by(Category.name).all()
    return [{"id": c.id, "name": c.name} for c in cats]


@router.get("/devices")
def pos_devices(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """List fiscal devices available for this company."""
    ensure_company_access(db, user, company_id)
    devices = db.query(Device).filter(Device.company_id == company_id).all()
    return [
        {
            "id": d.id,
            "device_id": d.device_id,
            "serial_number": d.serial_number,
            "model": d.model,
            "fiscal_day_status": d.fiscal_day_status,
        }
        for d in devices
    ]


@router.get("/customers")
def pos_customers(
    company_id: int,
    search: str = "",
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Quick customer search for POS."""
    ensure_company_access(db, user, company_id)
    q = db.query(Contact).filter(Contact.company_id == company_id)
    if search:
        like = f"%{search}%"
        q = q.filter(Contact.name.ilike(like) | Contact.email.ilike(like) | Contact.phone.ilike(like))
    contacts = q.order_by(Contact.name).limit(limit).all()
    return [
        {"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "tin": getattr(c, "tin", "")}
        for c in contacts
    ]


@router.get("/company-info")
def pos_company_info(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Company info for POS receipt header."""
    ensure_company_access(db, user, company_id)
    co = db.query(Company).filter(Company.id == company_id).first()
    if not co:
        raise HTTPException(404, "Company not found")
    # Get logo from company settings
    settings = db.query(CompanySettings).filter(CompanySettings.company_id == company_id).first()
    logo_data = settings.logo_data if settings and settings.logo_data else ""
    return {
        "id": co.id,
        "name": co.name,
        "address": co.address,
        "phone": co.phone,
        "email": co.email,
        "tin": co.tin,
        "vat": co.vat,
        "logo_data": logo_data,
    }


# ── POS Employee Management ────────────────────────────────────────────────

@router.get("/employees", response_model=List[POSEmployeeRead])
def list_pos_employees(
    company_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """List POS employees for a company."""
    ensure_company_access(db, user, company_id)
    q = db.query(POSEmployee).filter(POSEmployee.company_id == company_id)
    if not include_inactive:
        q = q.filter(POSEmployee.is_active == True)
    return q.order_by(POSEmployee.sort_order, POSEmployee.name).all()


@router.post("/employees", response_model=POSEmployeeRead)
def create_pos_employee(
    payload: POSEmployeeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Create a new POS employee."""
    ensure_company_access(db, user, payload.company_id)
    # Check PIN uniqueness within company
    if payload.pin:
        existing = db.query(POSEmployee).filter(
            POSEmployee.company_id == payload.company_id,
            POSEmployee.pin == payload.pin,
            POSEmployee.is_active == True,
        ).first()
        if existing:
            raise HTTPException(400, f"PIN already used by employee: {existing.name}")
    emp = POSEmployee(**payload.dict())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/employees/{employee_id}", response_model=POSEmployeeRead)
def get_pos_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Get a POS employee."""
    emp = db.query(POSEmployee).filter(POSEmployee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "POS employee not found")
    ensure_company_access(db, user, emp.company_id)
    return emp


@router.put("/employees/{employee_id}", response_model=POSEmployeeRead)
def update_pos_employee(
    employee_id: int,
    payload: POSEmployeeUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Update a POS employee."""
    emp = db.query(POSEmployee).filter(POSEmployee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "POS employee not found")
    ensure_company_access(db, user, emp.company_id)
    # Check PIN uniqueness if changed
    update_data = payload.dict(exclude_unset=True)
    if "pin" in update_data and update_data["pin"]:
        existing = db.query(POSEmployee).filter(
            POSEmployee.company_id == emp.company_id,
            POSEmployee.pin == update_data["pin"],
            POSEmployee.is_active == True,
            POSEmployee.id != employee_id,
        ).first()
        if existing:
            raise HTTPException(400, f"PIN already used by employee: {existing.name}")
    for field, value in update_data.items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/employees/{employee_id}")
def delete_pos_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Delete a POS employee."""
    emp = db.query(POSEmployee).filter(POSEmployee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "POS employee not found")
    ensure_company_access(db, user, emp.company_id)
    db.delete(emp)
    db.commit()
    return {"detail": "Employee deleted"}


class _VerifyPinPayload(BaseModel):
    company_id: int
    pin: str


@router.post("/employees/verify-pin")
def verify_pos_pin(
    payload: _VerifyPinPayload,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    """Verify a POS employee PIN and return employee info."""
    ensure_company_access(db, user, payload.company_id)
    emp = db.query(POSEmployee).filter(
        POSEmployee.company_id == payload.company_id,
        POSEmployee.pin == payload.pin,
        POSEmployee.is_active == True,
    ).first()
    if not emp:
        raise HTTPException(401, "Invalid PIN")
    return {"id": emp.id, "name": emp.name, "role": emp.role}

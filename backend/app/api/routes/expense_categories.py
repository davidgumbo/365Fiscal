from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, ensure_company_access, require_company_access
from app.models.expense_category import ExpenseCategory
from app.schemas.expense_category import ExpenseCategoryCreate, ExpenseCategoryUpdate, ExpenseCategoryRead

router = APIRouter(prefix="/expense-categories", tags=["expense-categories"])


@router.post("", response_model=ExpenseCategoryRead)
def create_expense_category(
    payload: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_company_access(db, user, payload.company_id)
    category = ExpenseCategory(**payload.dict())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("", response_model=list[ExpenseCategoryRead])
def list_expense_categories(
    company_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_company_access),
):
    return (
        db.query(ExpenseCategory)
        .filter(ExpenseCategory.company_id == company_id)
        .order_by(ExpenseCategory.name)
        .all()
    )


@router.get("/{category_id}", response_model=ExpenseCategoryRead)
def get_expense_category(
    category_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")
    ensure_company_access(db, user, category.company_id)
    return category


@router.patch("/{category_id}", response_model=ExpenseCategoryRead)
def update_expense_category(
    category_id: int,
    payload: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")
    ensure_company_access(db, user, category.company_id)

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_expense_category(
    category_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")
    ensure_company_access(db, user, category.company_id)

    db.delete(category)
    db.commit()
    return {"message": "Expense category deleted"}

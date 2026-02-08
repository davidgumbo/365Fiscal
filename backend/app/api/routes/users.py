from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, get_current_user
from app.models.company_user import CompanyUser
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.security.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def read_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.company import Company
    links = db.query(CompanyUser).filter(CompanyUser.user_id == user.id, CompanyUser.is_active == True).all()
    company_ids = [link.company_id for link in links]
    companies = db.query(Company).filter(Company.id.in_(company_ids)).all() if company_ids else []
    return {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "company_ids": company_ids,
        "companies": [
            {"id": c.id, "name": c.name, "tin": c.tin, "vat": c.vat, "email": c.email, "phone": c.phone, "address": c.address}
            for c in companies
        ],
    }


@router.post("", response_model=UserRead, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=payload.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserRead], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.patch("/{user_id}", response_model=UserRead, dependencies=[Depends(require_admin)])
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None:
        user.hashed_password = hash_password(payload.password)
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}

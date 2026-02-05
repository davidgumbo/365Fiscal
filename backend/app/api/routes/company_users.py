from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.company_user import CompanyUser
from app.models.user import User
from app.schemas.company_user import CompanyUserCreate, CompanyUserRead
from app.security.security import hash_password

router = APIRouter(prefix="/company-users", tags=["company-users"])


@router.post("", response_model=CompanyUserRead, dependencies=[Depends(require_admin)])
def link_user(payload: CompanyUserCreate, db: Session = Depends(get_db)):
    link = CompanyUser(**payload.dict())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("", response_model=list[CompanyUserRead], dependencies=[Depends(require_admin)])
def list_links(company_id: int | None = None, user_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(CompanyUser)
    if company_id is not None:
        query = query.filter(CompanyUser.company_id == company_id)
    if user_id is not None:
        query = query.filter(CompanyUser.user_id == user_id)
    return query.all()


@router.get("/portal-users", dependencies=[Depends(require_admin)])
def get_portal_users(company_id: int, db: Session = Depends(get_db)):
    """Get portal users linked to a company with their details."""
    links = db.query(CompanyUser).filter(
        CompanyUser.company_id == company_id,
        CompanyUser.role == "portal"
    ).all()
    user_ids = [link.user_id for link in links]
    if not user_ids:
        return []
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return [{"id": u.id, "email": u.email, "is_active": u.is_active} for u in users]


@router.patch("/portal-users/{user_id}/password", dependencies=[Depends(require_admin)])
def update_portal_password(user_id: int, password: str = None, db: Session = Depends(get_db)):
    """Update a portal user's password."""
    if not password:
        return {"error": "Password is required"}
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(password)
    db.commit()
    return {"status": "password updated"}
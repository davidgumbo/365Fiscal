from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from functools import wraps
from typing import Callable, List, Optional
import json

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company_user import CompanyUser
from app.models.user import User
from app.models.role import Role
from app.models.audit_log import AuditLog, AuditAction, ResourceType


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/password-login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def require_portal_user(user: User = Depends(get_current_user)) -> User:
    """Require an authenticated user (portal or admin)."""
    # Allow both portal users and admins to access these endpoints
    return user


def require_company_access(
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    if user.is_admin:
        return
    link = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user.id,
            CompanyUser.is_active == True,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")


def ensure_company_access(db: Session, user: User, company_id: int) -> None:
    if user.is_admin:
        return
    link = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user.id,
            CompanyUser.is_active == True,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")


def get_user_role_for_company(db: Session, user: User, company_id: int) -> Optional[Role]:
    """Get the user's role for a specific company."""
    if user.is_admin:
        # System admin gets system_admin role
        return db.query(Role).filter(Role.name == "system_admin").first()
    
    link = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user.id,
            CompanyUser.is_active == True,
        )
        .first()
    )
    if not link:
        return None
    
    # If role_id is set, use it; otherwise look up by role name
    if link.role_id:
        return db.query(Role).filter(Role.id == link.role_id).first()
    return db.query(Role).filter(Role.name == link.role).first()


def get_user_company_link(db: Session, user: User, company_id: int) -> Optional[CompanyUser]:
    """Get the CompanyUser link for a user and company."""
    if user.is_admin:
        return None  # Admin doesn't need a link
    return (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user.id,
            CompanyUser.is_active == True,
        )
        .first()
    )


def check_permission(db: Session, user: User, company_id: int, permission: str) -> bool:
    """Check if user has a specific permission for a company."""
    role = get_user_role_for_company(db, user, company_id)
    if not role:
        return False
    return getattr(role, permission, False)


def require_permission(permission: str):
    """Decorator factory for requiring a specific permission."""
    def dependency(
        company_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        if not check_permission(db, user, company_id, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}"
            )
        return user
    return dependency


def require_any_permission(permissions: List[str]):
    """Decorator factory for requiring any of multiple permissions."""
    def dependency(
        company_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        for perm in permissions:
            if check_permission(db, user, company_id, perm):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: requires one of {permissions}"
        )
    return dependency


def require_company_admin(
    company_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """Require user to be a company admin or system admin."""
    if user.is_admin:
        return user
    
    link = get_user_company_link(db, user, company_id)
    if not link:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company access denied")
    
    if link.is_company_admin or link.role in ("company_admin", "admin"):
        return user
    
    role = get_user_role_for_company(db, user, company_id)
    if role and role.name == "company_admin":
        return user
    
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company admin access required")


def require_system_admin(user: User = Depends(get_current_user)) -> User:
    """Require user to be a system admin (can create companies)."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="System administrator access required"
        )
    return user


# Audit logging helper
def log_audit(
    db: Session,
    user: Optional[User],
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    resource_reference: str = "",
    company_id: Optional[int] = None,
    company_name: str = "",
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    changes_summary: str = "",
    status: str = "success",
    error_message: str = "",
    ip_address: str = "",
    user_agent: str = "",
    request_id: str = "",
):
    """Create an audit log entry."""
    log_entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else "",
        company_id=company_id,
        company_name=company_name,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_reference=resource_reference,
        old_values=json.dumps(old_values) if old_values else "{}",
        new_values=json.dumps(new_values) if new_values else "{}",
        changes_summary=changes_summary,
        status=status,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
    )
    db.add(log_entry)
    return log_entry


# Permission check helper functions for specific actions
def can_create_invoice(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_create_invoices")

def can_confirm_invoice(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_confirm_invoices")

def can_fiscalize_invoice(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_fiscalize_invoices")

def can_configure_fiscal_devices(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_configure_fiscal_devices")

def can_create_quotation(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_create_quotations")

def can_convert_quotation(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_convert_quotations")

def can_create_credit_note(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_create_credit_notes")

def can_record_payment(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_record_payments")

def can_adjust_stock(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_adjust_stock")

def can_view_audit_logs(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_view_audit_logs")

def can_view_fiscal_reports(db: Session, user: User, company_id: int) -> bool:
    return check_permission(db, user, company_id, "can_view_fiscal_reports")

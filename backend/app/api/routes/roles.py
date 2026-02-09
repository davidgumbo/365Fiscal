"""Role management API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, require_admin, get_current_user
from app.models.role import Role, SYSTEM_ROLES
from app.schemas.role import RoleCreate, RoleUpdate, RoleRead

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=List[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all available roles."""
    return db.query(Role).order_by(Role.level.desc()).all()


@router.get("/{role_id}", response_model=RoleRead)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get a specific role by ID."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.get("/by-name/{role_name}", response_model=RoleRead)
def get_role_by_name(
    role_name: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get a specific role by name."""
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("", response_model=RoleRead)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Create a new custom role. Only system admins can create roles."""
    existing = db.query(Role).filter(Role.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role with this name already exists")
    
    role = Role(**payload.dict())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleRead)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Update a role. System roles can only have display_name and description updated."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    update_data = payload.dict(exclude_unset=True)
    
    # System roles can only have display_name and description updated
    if role.is_system_role:
        allowed_fields = {"display_name", "description"}
        update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    for field, value in update_data.items():
        setattr(role, field, value)
    
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Delete a custom role. System roles cannot be deleted."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    
    # Check if role is in use
    from app.models.company_user import CompanyUser
    in_use = db.query(CompanyUser).filter(
        (CompanyUser.role_id == role_id) | (CompanyUser.role == role.name)
    ).first()
    if in_use:
        raise HTTPException(status_code=400, detail="Role is in use and cannot be deleted")
    
    db.delete(role)
    db.commit()
    return {"message": "Role deleted"}


@router.post("/init-system-roles")
def init_system_roles(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Initialize or update system roles. Idempotent operation."""
    created = 0
    updated = 0
    
    for role_data in SYSTEM_ROLES:
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if existing:
            for key, value in role_data.items():
                setattr(existing, key, value)
            updated += 1
        else:
            role = Role(**role_data)
            db.add(role)
            created += 1
    
    db.commit()
    return {"message": f"System roles initialized: {created} created, {updated} updated"}

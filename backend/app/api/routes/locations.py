from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, ensure_company_access, require_portal_user
from app.models.location import Location
from app.models.warehouse import Warehouse
from app.schemas.location import LocationCreate, LocationUpdate, LocationRead

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("", response_model=LocationRead)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    warehouse = db.query(Warehouse).filter(Warehouse.id == payload.warehouse_id).first()
    if warehouse:
        ensure_company_access(db, user, warehouse.company_id)
    location = Location(**payload.dict())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("", response_model=list[LocationRead])
def list_locations(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if warehouse:
        ensure_company_access(db, user, warehouse.company_id)
    return db.query(Location).filter(Location.warehouse_id == warehouse_id).all()


@router.get("/{location_id}", response_model=LocationRead)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == location.warehouse_id).first()
    if warehouse:
        ensure_company_access(db, user, warehouse.company_id)
    return location


@router.patch("/{location_id}", response_model=LocationRead)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == location.warehouse_id).first()
    if warehouse:
        ensure_company_access(db, user, warehouse.company_id)
    
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(location, key, value)
    
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_portal_user),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == location.warehouse_id).first()
    if warehouse:
        ensure_company_access(db, user, warehouse.company_id)
    
    db.delete(location)
    db.commit()
    return {"message": "Location deleted"}

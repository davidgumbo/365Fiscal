from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.models.company import Company
from app.models.company_user import CompanyUser
from app.models.role import Role, SYSTEM_ROLES
from app.security.security import hash_password

app = FastAPI(
    title=settings.app_name,
    description="Multi-Company Invoicing & Fiscalization System",
    version="2.0.0",
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def ensure_system_roles():
    """Initialize or update system roles on startup."""
    db = SessionLocal()
    try:
        for role_data in SYSTEM_ROLES:
            existing = db.query(Role).filter(Role.name == role_data["name"]).first()
            if existing:
                # Update existing role
                for key, value in role_data.items():
                    setattr(existing, key, value)
            else:
                # Create new role
                role = Role(**role_data)
                db.add(role)
        db.commit()
    except Exception as e:
        print(f"Error initializing system roles: {e}")
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def ensure_default_admin():
    if not settings.default_admin_email or not settings.default_admin_password:
        return
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.default_admin_email).first()
        if not existing:
            admin = User(
                email=settings.default_admin_email,
                hashed_password=hash_password(settings.default_admin_password),
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
        else:
            existing.hashed_password = hash_password(settings.default_admin_password)
            existing.is_admin = True
            existing.is_active = True
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def ensure_default_portal_user():
    if not settings.default_portal_email or not settings.default_portal_password or not settings.default_portal_company:
        return
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name == settings.default_portal_company).first()
        if not company:
            company = Company(name=settings.default_portal_company)
            db.add(company)
            db.flush()
        user = db.query(User).filter(User.email == settings.default_portal_email).first()
        if not user:
            user = User(
                email=settings.default_portal_email,
                hashed_password=hash_password(settings.default_portal_password),
                is_admin=False,
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user.hashed_password = hash_password(settings.default_portal_password)
            user.is_admin = False
            user.is_active = True
        
        # Get company_admin role
        company_admin_role = db.query(Role).filter(Role.name == "company_admin").first()
        
        link = (
            db.query(CompanyUser)
            .filter(CompanyUser.company_id == company.id, CompanyUser.user_id == user.id)
            .first()
        )
        if not link:
            db.add(CompanyUser(
                company_id=company.id, 
                user_id=user.id, 
                role="company_admin",
                role_id=company_admin_role.id if company_admin_role else None,
                is_active=True,
                is_company_admin=True,
            ))
        else:
            link.role = "company_admin"
            link.is_company_admin = True
            if company_admin_role:
                link.role_id = company_admin_role.id
        db.commit()
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": "2.0.0",
        "description": "Multi-Company Invoicing & Fiscalization System",
        "docs": "/docs",
        "health": "/health",
    }

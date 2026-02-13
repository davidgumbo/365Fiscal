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
        # allow_origins=[origins]
        allow_origins=["*"],
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
        # Race condition: another worker may have already inserted the rows
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
    except Exception:
        # Race condition: another worker already created the admin user
        db.rollback()
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
    except Exception:
        # Race condition: another worker already created the portal user/company
        db.rollback()
    finally:
        db.close()


# --------------- Background device ping scheduler ---------------
import threading
import time
import logging
import sys
import os

_ping_logger = logging.getLogger("device_ping")
_ping_logger.setLevel(logging.INFO)
if not _ping_logger.handlers:
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s"))
    _ping_logger.addHandler(_handler)

# Only start one ping thread across workers (use PID file to coordinate)
_PING_LOCK_FILE = "/tmp/365fiscal_ping.lock"


def _ping_all_devices():
    """Ping every registered device that has a certificate to keep them online."""
    from app.models.device import Device
    from app.services.fdms import ping_device
    from datetime import datetime

    db = SessionLocal()
    try:
        devices = (
            db.query(Device)
            .filter(Device.crt_data.isnot(None), Device.key_data.isnot(None))
            .all()
        )
        _ping_logger.info("Found %d registered devices to ping", len(devices))
        for device in devices:
            try:
                result = ping_device(device, db)
                device.last_ping_at = datetime.utcnow()
                if result.get("reportingFrequency"):
                    device.reporting_frequency = int(result["reportingFrequency"])
                db.commit()
                _ping_logger.info("Pinged device %s (ID %s) OK", device.device_id, device.id)
            except Exception as e:
                _ping_logger.warning("Ping failed for device %s: %s", device.device_id, e)
                db.rollback()
    except Exception as e:
        _ping_logger.error("Ping loop error: %s", e)
    finally:
        db.close()


def _ping_loop():
    """Background thread that pings devices every 3 minutes."""
    _ping_logger.info("Ping loop thread started, first ping in 10 seconds...")
    time.sleep(10)  # wait for app to be fully ready
    while True:
        try:
            _ping_all_devices()
        except Exception as e:
            _ping_logger.error("Ping loop exception: %s", e)
        time.sleep(180)  # 3 minutes


@app.on_event("startup")
def start_ping_scheduler():
    """Start the background ping thread on app startup (only in first worker)."""
    try:
        # Simple coordination: only the first worker to grab the lock file starts the thread
        pid = str(os.getpid())
        if os.path.exists(_PING_LOCK_FILE):
            try:
                with open(_PING_LOCK_FILE) as f:
                    old_pid = f.read().strip()
                # Check if old process is still alive
                if old_pid and os.path.exists(f"/proc/{old_pid}"):
                    _ping_logger.info("Ping scheduler already running in PID %s, skipping", old_pid)
                    return
            except Exception:
                pass
        with open(_PING_LOCK_FILE, "w") as f:
            f.write(pid)
        t = threading.Thread(target=_ping_loop, daemon=True, name="device-ping")
        t.start()
        _ping_logger.info("Device ping scheduler started in PID %s (every 3 min)", pid)
    except Exception as e:
        _ping_logger.error("Failed to start ping scheduler: %s", e)


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

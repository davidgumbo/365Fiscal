import secrets
from datetime import datetime, timedelta
from passlib.context import CryptContext

from app.core.config import settings

otp_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(code: str) -> str:
    return otp_context.hash(code)


def verify_otp(code: str, code_hash: str) -> bool:
    return otp_context.verify(code, code_hash)


def otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=settings.otp_ttl_minutes)
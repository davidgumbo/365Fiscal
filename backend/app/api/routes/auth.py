from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.models.user import User
from app.models.otp import OTPChallenge
from app.schemas.auth import LoginRequest, OTPVerifyRequest, TokenResponse
from app.security.security import verify_password, create_access_token
from app.security.otp import generate_otp_code, hash_otp, otp_expiry, verify_otp
from app.services.email import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    otp_code = generate_otp_code()
    challenge = OTPChallenge(
        user_id=user.id,
        code_hash=hash_otp(otp_code),
        expires_at=otp_expiry(),
    )
    db.add(challenge)
    db.commit()

    send_otp_email(user.email, otp_code)
    response = {"message": "OTP sent"}
    if settings.otp_dev_mode:
        response["otp_code"] = otp_code
    return response


@router.post("/password-login", response_model=TokenResponse)
def password_login(payload: LoginRequest, db: Session = Depends(get_db)):
    with open("login_debug.log", "a") as f:
        f.write(f"[{datetime.now()}] DEBUG LOGIN: Attempting login for '{payload.email}' with password '{payload.password}'\n")
        user = db.query(User).filter(User.email == payload.email).first()
        f.write(f"[{datetime.now()}] DEBUG LOGIN: User found? {user is not None}\n")
        if user:
             f.write(f"[{datetime.now()}] DEBUG LOGIN: Stored hash: {user.hashed_password}\n")
             verification = verify_password(payload.password, user.hashed_password)
             f.write(f"[{datetime.now()}] DEBUG LOGIN: Hash verification result: {verification}\n")

    if not user or not verify_password(payload.password, user.hashed_password):
        with open("login_debug.log", "a") as f:
            f.write(f"[{datetime.now()}] DEBUG LOGIN: FAILED. User: {user}, payload pass: {payload.password}\n")
            if user:
                f.write(f"[{datetime.now()}] DEBUG LOGIN: Stored hash: {user.hashed_password}\n")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials (DEBUG_CHECK)")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_login(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    challenge = (
        db.query(OTPChallenge)
        .filter(OTPChallenge.user_id == user.id)
        .order_by(OTPChallenge.created_at.desc())
        .first()
    )
    if not challenge or challenge.consumed_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP not found")
    if challenge.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP expired")
    if not verify_otp(payload.otp_code, challenge.code_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")

    challenge.consumed_at = datetime.utcnow()
    db.commit()

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)

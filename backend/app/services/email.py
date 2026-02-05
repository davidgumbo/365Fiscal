from app.core.config import settings


def send_otp_email(to_email: str, otp_code: str) -> None:
    if settings.otp_dev_mode:
        # In dev mode, we do not send emails. Log to console.
        print(f"[DEV OTP] Send OTP to {to_email}: {otp_code}")
        return
    # TODO: Integrate real email provider (SMTP, SendGrid, etc.)
    raise NotImplementedError("Email provider not configured")
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "365 FISCAL"
    env: str = "dev"
    secret_key: str
    access_token_expire_minutes: int = 60
    database_url: str
    otp_ttl_minutes: int = 10
    otp_dev_mode: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    default_admin_email: str | None = None
    default_admin_password: str | None = None
    default_portal_email: str | None = None
    default_portal_password: str | None = None
    default_portal_company: str | None = None
    fdms_api_url: str = "https://fdmsapi.zimra.co.zw"
    fdms_verify_ssl: bool = True
    fdms_timeout_seconds: int = 30

    class Config:
        env_file = ".env"


settings = Settings()

# Backend Documentation (FastAPI)

This document details the backend architecture, environment, models, migrations, services, and how to run the API locally.

## Stack

- FastAPI application with Uvicorn.
- SQLAlchemy ORM + Alembic migrations.
- Pydantic schemas.
- JWT auth + OTP.
- Domain services (FDMS, email, sequence).

## Layout

- `app/main.py`: FastAPI app factory and router mounting.
- `app/core/config.py`: Settings loaded from environment.
- `app/db/session.py`: SessionLocal + engine creation.
- `app/db/base.py`: Imports models for Alembic autogenerate and metadata.
- `app/models/*`: ORM models (company, user, product, invoice, stock, device, tax settings...).
- `app/schemas/*`: Pydantic DTOs matching models.
- `app/api/`: Routers and dependencies.
  - `api/deps.py`: auth dependencies and permission checks.
  - `api/routes/`: route modules grouped by domain.
- `app/security/`: `security.py` (JWT), `otp.py`.
- `app/services/`: integration and domain services (`fdms.py`, `email.py`, `sequence.py`).
- `alembic/`: migrations, `alembic.ini`.

## Environment

- Copy `.env.example` to `.env` and populate:
  - `DATABASE_URL` (e.g., `postgresql+psycopg2://user:pass@localhost:5432/365fiscal`)
  - `JWT_SECRET`, `JWT_ALG`, `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `CORS_ORIGINS` (comma-separated origins)
  - FDMS and email settings

## Migrations

- Alembic tracks schema changes under `alembic/versions/`:
  - `e6bc0f216b36_initial.py`: initial baseline
  - `a8f3b2c1d4e5_stock_and_invoice_lines.py`: stock/invoice lines
  - `dd344aba7187_fdms_fiscalization_fields.py`: fiscalization fields
  - `f2a1c9b8d0a1_add_odoo_settings_fields.py`: Odoo settings
  - `f7c9d2a1b3c4_add_invoice_type_credit_note.py`: credit note type
  - `235b5e8194a7_tax_settings_and_certificates.py`: tax settings/certificates

## Auth

- Password login endpoint returns JWT access token.
- OTP utilities support 2FA flows.
- Use `Depends` from `api/deps.py` to protect routes.

## Services

- `fdms.py`: handles fiscalization requests to FDMS provider.
- `email.py`: outbound mail notifications.
- `sequence.py`: generate sequential identifiers for records.

## Running Locally (macOS, zsh)

```
cd 365Fiscal/backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with credentials and URLs
PYTHONPATH=$PWD ../.venv/bin/alembic upgrade head
PYTHONPATH=$PWD ../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Health Check

If `/health` is missing, add to `app/main.py`:

```python
from fastapi import FastAPI
app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
```

## Testing Endpoints

- Login:

```
curl -s -X POST http://127.0.0.1:8000/api/auth/password-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"portal@365fiscal.local","password":"portal123"}' -i
```

- Example list endpoints:

```
curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/companies
curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/products
```

## Notes

- Ensure `PYTHONPATH=$PWD` so Alembic and Uvicorn import `app.*` properly.
- CORS must include your frontend dev origin (e.g., `http://localhost:5173`).
- Secrets should never be committed; use `.env` and environment variables in production.

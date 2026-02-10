# 365Fiscal System Documentation

This document explains how the 365Fiscal system works end-to-end: architecture, backend services, frontend app, deployments, environments, and how to run it locally.

## Overview

365Fiscal is a full-stack system for company, product, stock, invoice, and fiscalization workflows.

- Backend: FastAPI app (`backend/app`) using SQLAlchemy with Alembic migrations, Pydantic schemas, JWT-based auth, and integrations (FDMS).
- Frontend: React + TypeScript (Vite) with Tailwind CSS (`frontend/src`), talking to the backend via REST.
- Deploy: Shell scripts for provisioning, updating, and managing services (`deploy/`).

## Architecture

- API server (`uvicorn app.main:app`): Exposes routes under `/api/...` for auth, companies, products, devices, invoices, stock, tax settings, etc.
- Data layer: SQLAlchemy session + models in `backend/app/db` and `backend/app/models`; migrations in `backend/alembic`.
- Schemas: Pydantic request/response models in `backend/app/schemas` ensure typed validation.
- Services: Domain services in `backend/app/services` (e.g., `fdms.py`, `email.py`, `sequence.py`).
- Security: JWT<!--/OTP--> and role-based access in `backend/app/security` and `backend/app/api/deps.py`.
- Frontend: SPA that consumes REST endpoints, with contexts/hooks and pages for dashboard and domain entities.

```
+------------------+        HTTP/JSON         +------------------+
|  React Frontend  | <---------------------> |   FastAPI API    |
|  Vite + Tailwind |                         |  Uvicorn server  |
+------------------+                         +------------------+
          |                                          |
          |                                          v
          |                                   SQLAlchemy ORM
          |                                          |
          |                                          v
          |                                   Postgres (or DB)
          |
          v
User browser                            External Services (FDMS)
```

## Backend

- Entry: `backend/app/main.py` creates the FastAPI app, mounts routers, and configures CORS.
- Config: `backend/app/core/config.py` reads environment variables (database URL, JWT settings, CORS, mail, FDMS, etc.).
- DB: `backend/app/db/session.py` provides session factory; `backend/app/db/base.py` imports models for Alembic.
- Migrations: Alembic versions under `backend/alembic/versions/*` track schema evolution (initial, stock/invoice lines, fiscalization fields, tax settings, credit notes, etc.).
- Models: Rich domain in `backend/app/models/` including `company`, `user`, `product`, `invoice`, `invoice_line`, `stock_move`, `stock_quant`, `warehouse`, `location`, `device`, `tax_setting`, `company_certificate`, `chatter`, etc.
- Schemas: Matching Pydantic DTOs in `backend/app/schemas/` for API I/O.
- Security: `backend/app/security/` with `security.py` (JWT), `otp.py`, and FastAPI dependencies in `backend/app/api/deps.py`.
- Routes: Organized under `backend/app/api/routes/` (auth, dashboard, companies, products, stocks, invoices, tax settings...).
- Services: `fdms.py` for fiscalization; `email.py`; `sequence.py` for generating sequence numbers.

### Auth Flow

- Password login: `POST /api/auth/password-login` returns a JWT access token on success.
<!-- - OTP flow: Generating and verifying one-time codes via `security/otp`. -->
- Per-request auth: Dependencies in `api/deps.py` decode JWT, attach user, and enforce permissions.

### Health and Utilities

- Health: implement `/health` (if missing) to return service status.
- Utility scripts: under `backend` (e.g., `reset_password.py`, `check_server_conn.py`, `migrate_invoices.py`).

## Frontend

- App bootstrap: `frontend/src/main.tsx` renders `App.tsx`.
- API client: `frontend/src/api.ts` centralizes HTTP calls to backend.
- UI: Tailwind CSS (`styles.css`, `tailwind.config.cjs`, `postcss.config.cjs`).
- Structure: `components/`, `pages/`, `context/`, and `hooks/` implement views and state management.
- Dev: Vite config in `vite.config.ts`; TypeScript `tsconfig.json`.

## Deployment

- Scripts in `deploy/`:
  - `install.sh`: Initial setup of dependencies and environment.
  - `deploy_365fiscal.sh`: Deploy/update application on servers.
  - `update_365fiscal.sh`: Update services to latest version.
  - `manage_365fiscal.sh`: Start/stop/status commands.
- CI/CD can call these scripts to manage releases.

## Environments

- Backend `.env` file (see `backend/.env.example`):
  - `DATABASE_URL`: SQLAlchemy DSN (e.g., Postgres).
  - `JWT_SECRET`, `JWT_ALG`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
  - `CORS_ORIGINS`: Allowed origins for frontend.
  - `FDMS_*`: Fiscalization integration settings.
  - Mail and other service credentials.

## Local Development (macOS, zsh)

Prerequisites: Python 3.10+, Node 18+, Postgres (or your DB), virtualenv.

1) Setup Python env and install backend deps:

```
cd 365Fiscal/backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
```

2) Configure `.env` and run migrations:

```
cp .env.example .env
# edit .env with your DATABASE_URL and secrets
PYTHONPATH=$PWD ../.venv/bin/alembic upgrade head
```

3) Start API server:

```
PYTHONPATH=$PWD ../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

4) Start frontend:

```
cd ../frontend
npm install
npm run dev
```

5) Test login:

```
curl -s -X POST http://127.0.0.1:8000/api/auth/password-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"portal@365fiscal.local","password":"portal123"}' -i
```

## Key Endpoints (examples)

- `POST /api/auth/password-login`: Login and get JWT.
- `GET /api/companies`: List companies.
- `GET /api/products`: List products.
- `GET /api/invoices`: List invoices.
- `POST /api/invoices`: Create invoice; may trigger fiscalization via `services/fdms.py`.
- `GET /api/stock/moves`: Stock movements.
- `GET /api/stock/quants`: Stock on hand.
- `GET /api/tax-settings`: Tax configurations.

Exact routes live in `backend/app/api/routes/`.

## Data Model Highlights

- Company and User: multi-tenant capability via `company_user` mapping.
- Inventory: `product`, `stock_move`, `stock_quant`, `warehouse`, `location`.
- Sales: `quotation`, `quotation_line`, `invoice`, `invoice_line` with credit note support.
- Fiscalization: `tax_setting`, `company_certificate`, `device` plus FDMS service calls.
- Communication: `chatter` threads on records.

## Security

- JWT-based auth with access token expiry and optional OTP.
- Role/permission checks in API dependencies.
- CORS configured to restrict frontend origins.
- Secrets loaded from environment; do not commit real keys.

## Troubleshooting

- Port conflicts: ensure nothing else listens on `127.0.0.1:8000`.
- Health check: if `/health` returns 404, add a simple FastAPI route.
- Alembic issues: verify `PYTHONPATH=$PWD` so Alembic can import `db/base.py`.
- CORS errors: set `CORS_ORIGINS` to your frontend dev URL (e.g., `http://localhost:5173`).

## Next Steps

- Add OpenAPI docs by visiting `http://127.0.0.1:8000/docs` (FastAPI auto-docs) if enabled.
- Expand `/deploy` scripts for your infrastructure.
- Set up CI to lint, test, and build.

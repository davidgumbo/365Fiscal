#!/bin/bash
# 365 Fiscal Deployment Script for Digital Ocean Ubuntu
# Backend: Port 8089
# Frontend: Port 8070
# Database: PostgreSQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  365 Fiscal Deployment Script${NC}"
echo -e "${GREEN}============================================${NC}"

# Configuration Variables
APP_DIR="/opt/365_fiscal"
BACKEND_PORT=8089
FRONTEND_PORT=8070
DB_NAME="fiscal365"
DB_USER="fiscal365_user"
DB_PASSWORD="fiscal365_secure_$(openssl rand -hex 8)"
SECRET_KEY="$(openssl rand -hex 32)"
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Step 2: Installing required packages...${NC}"
apt install -y python3 python3-pip python3-venv postgresql postgresql-contrib nginx curl git nodejs npm

# Install Node.js 20.x if not available
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

echo -e "${YELLOW}Step 3: Setting up PostgreSQL...${NC}"
# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
-- Drop existing if needed (comment out if you want to keep data)
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};

-- Create user and database
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

echo -e "${GREEN}Database created: ${DB_NAME}${NC}"
echo -e "${GREEN}Database user: ${DB_USER}${NC}"

echo -e "${YELLOW}Step 4: Setting up application directory...${NC}"
# Clone or update repository
if [ -d "${APP_DIR}" ]; then
    cd ${APP_DIR}
    git pull origin main || git pull origin master || true
else
    git clone https://github.com/davidgumbo/365Fiscal.git ${APP_DIR}
    cd ${APP_DIR}
fi

echo -e "${YELLOW}Step 5: Setting up Python virtual environment...${NC}"
cd ${APP_DIR}/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

echo -e "${YELLOW}Step 6: Creating backend .env file...${NC}"
cat > ${APP_DIR}/backend/.env <<EOF
APP_NAME=365 FISCAL
ENV=production
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=60
DATABASE_URL=postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
OTP_TTL_MINUTES=10
OTP_DEV_MODE=false
CORS_ORIGINS=http://${SERVER_IP}:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}
DEFAULT_ADMIN_EMAIL=admin@365fiscal.local
DEFAULT_ADMIN_PASSWORD=Admin@365Fiscal!
DEFAULT_PORTAL_EMAIL=portal@365fiscal.local
DEFAULT_PORTAL_PASSWORD=Portal@365!
DEFAULT_PORTAL_COMPANY=Portal Company
FDMS_API_URL=https://fdmsapi.zimra.co.zw
FDMS_VERIFY_SSL=true
FDMS_TIMEOUT_SECONDS=30
EOF

echo -e "${YELLOW}Step 7: Running database migrations...${NC}"
cd ${APP_DIR}/backend
source venv/bin/activate
alembic upgrade head

echo -e "${YELLOW}Step 8: Building frontend...${NC}"
cd ${APP_DIR}/frontend

# Create production vite config
cat > vite.config.ts <<EOF
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${FRONTEND_PORT},
    host: "0.0.0.0"
  },
  preview: {
    port: ${FRONTEND_PORT},
    host: "0.0.0.0"
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://${SERVER_IP}:${BACKEND_PORT}')
  }
});
EOF

# Update API base URL in frontend
if [ -f "${APP_DIR}/frontend/src/api.ts" ]; then
    # Create a simple env file for the frontend build
    echo "VITE_API_URL=http://${SERVER_IP}:${BACKEND_PORT}" > .env.production
fi

npm install
npm run build

echo -e "${YELLOW}Step 9: Creating systemd service for backend...${NC}"
cat > /etc/systemd/system/365fiscal-backend.service <<EOF
[Unit]
Description=365 Fiscal Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${APP_DIR}/backend
Environment="PATH=${APP_DIR}/backend/venv/bin"
ExecStart=${APP_DIR}/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${BACKEND_PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}Step 10: Configuring Nginx for frontend...${NC}"
cat > /etc/nginx/sites-available/365fiscal-frontend <<EOF
server {
    listen ${FRONTEND_PORT};
    listen [::]:${FRONTEND_PORT};
    server_name _;

    root ${APP_DIR}/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend (optional - for same-origin requests)
    location /api {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/365fiscal-frontend /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

echo -e "${YELLOW}Step 11: Starting services...${NC}"
systemctl daemon-reload
systemctl enable 365fiscal-backend
systemctl start 365fiscal-backend
systemctl restart nginx
systemctl enable nginx

echo -e "${YELLOW}Step 12: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow ${BACKEND_PORT}/tcp
    ufw allow ${FRONTEND_PORT}/tcp
    ufw allow 22/tcp
    ufw --force enable
fi

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${GREEN}Application URLs:${NC}"
echo -e "  Frontend: http://${SERVER_IP}:${FRONTEND_PORT}"
echo -e "  Backend API: http://${SERVER_IP}:${BACKEND_PORT}"
echo -e "  API Docs: http://${SERVER_IP}:${BACKEND_PORT}/docs"
echo ""
echo -e "${GREEN}Database Credentials:${NC}"
echo -e "  Database: ${DB_NAME}"
echo -e "  User: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo ""
echo -e "${GREEN}Default Admin Login:${NC}"
echo -e "  Email: admin@365fiscal.local"
echo -e "  Password: Admin@365Fiscal!"
echo ""
echo -e "${GREEN}Service Commands:${NC}"
echo -e "  Backend status:  systemctl status 365fiscal-backend"
echo -e "  Backend logs:    journalctl -u 365fiscal-backend -f"
echo -e "  Restart backend: systemctl restart 365fiscal-backend"
echo -e "  Restart nginx:   systemctl restart nginx"
echo ""

# Save credentials to file
cat > ${APP_DIR}/DEPLOYMENT_INFO.txt <<EOF
============================================
365 Fiscal Deployment Information
============================================
Deployed on: $(date)

Application URLs:
  Frontend: http://${SERVER_IP}:${FRONTEND_PORT}
  Backend API: http://${SERVER_IP}:${BACKEND_PORT}
  API Docs: http://${SERVER_IP}:${BACKEND_PORT}/docs

Database Credentials:
  Database: ${DB_NAME}
  User: ${DB_USER}
  Password: ${DB_PASSWORD}
  Connection String: postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

Default Admin Login:
  Email: admin@365fiscal.local
  Password: Admin@365Fiscal!

Default Portal Login:
  Email: portal@365fiscal.local
  Password: Portal@365!

Service Commands:
  Backend status:  systemctl status 365fiscal-backend
  Backend logs:    journalctl -u 365fiscal-backend -f
  Restart backend: systemctl restart 365fiscal-backend
  Restart nginx:   systemctl restart nginx
============================================
EOF

echo -e "${GREEN}Credentials saved to: ${APP_DIR}/DEPLOYMENT_INFO.txt${NC}"

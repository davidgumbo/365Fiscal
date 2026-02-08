#!/bin/bash
# Quick install script - download and run from anywhere
# Usage: curl -sSL https://raw.githubusercontent.com/davidgumbo/365Fiscal/main/deploy/install.sh | sudo bash

set -e

echo "Downloading 365 Fiscal deployment script..."

# Create directory if needed
mkdir -p /opt/365_fiscal

# Clone or update repo
if [ -d "/opt/365_fiscal/.git" ]; then
    cd /opt/365_fiscal
    git pull origin main || git pull origin master
else
    rm -rf /opt/365_fiscal
    git clone https://github.com/davidgumbo/365Fiscal.git /opt/365_fiscal
fi

# Make scripts executable
chmod +x /opt/365_fiscal/deploy/*.sh

# Run main deploy script
/opt/365_fiscal/deploy/deploy_365fiscal.sh

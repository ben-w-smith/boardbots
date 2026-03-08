#!/bin/bash
# BoardBots Deployment Script for DigitalOcean Droplet
# This script sets up the droplet with all required dependencies
# and configurations. It is idempotent and safe to run multiple times.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/boardbots"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="$APP_DIR/backups"
NGINX_SITE="/etc/nginx/sites-available/boardbots"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run this script as root or with sudo"
    exit 1
fi

log_info "Starting BoardBots deployment setup..."

# Update package lists
log_info "Updating package lists..."
apt-get update -qq

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $USER
else
    log_info "Docker already installed"
fi

# Install Docker Compose if not present
if ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose..."
    apt-get install -y docker-compose-plugin
else
    log_info "Docker Compose already installed"
fi

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    log_info "Installing Nginx..."
    apt-get install -y nginx
else
    log_info "Nginx already installed"
fi

# Install Certbot for SSL (if you have a domain)
if ! command -v certbot &> /dev/null; then
    log_info "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
else
    log_info "Certbot already installed"
fi

# Install wget for healthcheck
if ! command -v wget &> /dev/null; then
    apt-get install -y wget
fi

# Create application directory structure
log_info "Creating application directory structure..."
mkdir -p "$DATA_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$APP_DIR"

# Set up docker-compose.yml
log_info "Setting up docker-compose.yml..."
if [ ! -f "$COMPOSE_FILE" ]; then
    log_warn "docker-compose.yml not found at $COMPOSE_FILE"
    log_warn "Please copy it from the repository and update IMAGE_NAME"
    log_warn "Example:"
    log_warn "  scp deploy/docker-compose.yml root@<DROPLET_IP>:$COMPOSE_FILE"
else
    log_info "docker-compose.yml already exists"
fi

# Set up Nginx configuration
log_info "Setting up Nginx configuration..."
if [ ! -f "$NGINX_SITE" ]; then
    log_warn "Nginx config not found at $NGINX_SITE"
    log_warn "Please copy it from the repository and update SERVER_NAME"
    log_warn "Example:"
    log_warn "  scp deploy/nginx.conf root@<DROPLET_IP>:$NGINX_SITE"
else
    log_info "Nginx config already exists"
fi

# Configure firewall (UFW)
if command -v ufw &> /dev/null; then
    log_info "Configuring firewall..."
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    # Enable UFW if not already enabled (non-interactive)
    echo "y" | ufw enable 2>/dev/null || true
else
    log_warn "UFW not found, skipping firewall configuration"
fi

# Enable Nginx site if not already enabled
if [ -f "$NGINX_SITE" ] && [ ! -L "/etc/nginx/sites-enabled/boardbots" ]; then
    log_info "Enabling Nginx site..."
    ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/boardbots"
    # Remove default site if it exists
    rm -f "/etc/nginx/sites-enabled/default"
    # Test Nginx configuration
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log_info "Nginx configured successfully"
    else
        log_error "Nginx configuration test failed"
    fi
fi

# Set up automated backup cron job
log_info "Setting up automated backup..."
CRON_JOB="0 3 * * * cp $DATA_DIR/boardbots.db $BACKUP_DIR/boardbots-\$(date +\\%Y\\%m\\%d).db"
if ! crontab -l 2>/dev/null | grep -q "$BACKUP_DIR"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_info "Cron job added for daily backups at 3 AM"
else
    log_info "Cron job already configured"
fi

# Set proper permissions
log_info "Setting directory permissions..."
chmod 755 "$APP_DIR"
chmod 755 "$DATA_DIR"
chmod 755 "$BACKUP_DIR"

# Print deployment summary
echo ""
log_info "Deployment setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy docker-compose.yml to $COMPOSE_FILE"
echo "  2. Copy nginx.conf to $NGINX_SITE"
echo "  3. Update IMAGE_NAME in docker-compose.yml"
echo "  4. Update SERVER_NAME in nginx.conf (or use _ for IP-based access)"
echo "  5. Run: cd $APP_DIR && docker compose pull && docker compose up -d"
echo ""
echo "For SSL with a domain:"
echo "  1. Ensure DNS points to this droplet"
echo "  2. Run: certbot --nginx -d yourdomain.com"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose -f $COMPOSE_FILE logs -f"
echo "  - Restart: docker compose -f $COMPOSE_FILE restart"
echo "  - Update: docker compose -f $COMPOSE_FILE pull && docker compose -f $COMPOSE_FILE up -d"
echo "  - Nginx logs: tail -f /var/log/nginx/error.log"
echo ""

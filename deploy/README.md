# BoardBots DigitalOcean Deployment Guide

Deploy BoardBots to a DigitalOcean Droplet with Docker, Nginx, and SQLite.

---

## Prerequisites Checklist

- [ ] DigitalOcean account
- [ ] `doctl` CLI installed and authenticated (`doctl auth init`)
- [ ] SSH key uploaded to DigitalOcean
- [ ] Domain name (optional - can use Droplet IP)

---

## Quick Deploy (Automated with doctl)

### 1. Create Droplet

```bash
# List available SSH keys
doctl compute ssh-key list

# Create droplet (replace SSH_KEY_ID)
doctl compute droplet create boardbots \
  --image ubuntu-24-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc3 \
  --ssh-keys <SSH_KEY_ID> \
  --enable-monitoring \
  --tag-name boardbots \
  --wait
```

Note the IP address from the output.

### 2. Deploy Application

```bash
# Set the droplet IP
DROPLET_IP="YOUR_DROPLET_IP"

# Wait for SSH to be ready
for i in {1..12}; do
  ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "echo ready" && break
  sleep 5
done

# Install dependencies
ssh root@$DROPLET_IP 'apt-get update && apt-get install -y git nginx certbot python3-certbot-nginx curl'
ssh root@$DROPLET_IP 'curl -fsSL https://get.docker.com | sh'

# Create directories
ssh root@$DROPLET_IP 'mkdir -p /opt/boardbots/{data,backups}'

# Sync project files (from project root)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.wrangler' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@$DROPLET_IP:/opt/boardbots/src/

# Copy config files
scp -o StrictHostKeyChecking=no deploy/docker-compose.yml root@$DROPLET_IP:/opt/boardbots/
scp -o StrictHostKeyChecking=no deploy/nginx.conf root@$DROPLET_IP:/etc/nginx/sites-available/boardbots

# Build and start
ssh root@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:latest .'
ssh root@$DROPLET_IP 'ln -sf /etc/nginx/sites-available/boardbots /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx'
ssh root@$DROPLET_IP 'cd /opt/boardbots && docker compose up -d'

# Configure firewall
ssh root@$DROPLET_IP 'ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && echo "y" | ufw enable'
```

### 3. Verify

```bash
curl http://$DROPLET_IP/api/health
# Should return: OK
```

---

## Manual Deployment (Step-by-Step)

### 1. Create Droplet

1. Go to DigitalOcean → Create → Droplets
2. Choose **Ubuntu 24.04 LTS**
3. Choose **Basic** → **$6/month** (1GB RAM, 1 vCPU)
4. Add your SSH key
5. Hostname: `boardbots`
6. Create and note the IP address

### 2. Build Docker Image

```bash
# Build image
docker build -t boardbots:latest .
```

### 3. Deploy to Droplet

```bash
# Copy deployment files to droplet
scp deploy/docker-compose.yml root@<DROPLET_IP>:/opt/boardbots/
scp deploy/nginx.conf root@<DROPLET_IP>:/etc/nginx/sites-available/boardbots

# SSH into droplet and run setup
ssh root@<DROPLET_IP>
```

---

## SSL Certificate (Optional)

If you have a domain pointing to your droplet:

```bash
certbot --nginx -d yourdomain.com
```

Certbot will automatically configure HTTPS and set up auto-renewal.

---

## Update Process

To deploy a new version:

```bash
# Sync updated code
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@$DROPLET_IP:/opt/boardbots/src/

# Rebuild and restart
ssh root@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:latest . && cd /opt/boardbots && docker compose up -d'

# Check logs
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml logs -f'
```

---

## Useful Commands

```bash
# View logs
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml logs -f'

# Restart container
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml restart'

# Stop container
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml down'

# Check container status
ssh root@$DROPLET_IP 'docker ps'

# Nginx logs
ssh root@$DROPLET_IP 'tail -f /var/log/nginx/error.log'
```

---

## Backup and Restore

### Manual Backup

```bash
ssh root@$DROPLET_IP 'cp /opt/boardbots/data/boardbots.db /opt/boardbots/backups/boardbots.db.manual'
```

### Restore

```bash
ssh root@$DROPLET_IP 'cd /opt/boardbots && docker compose down && cp backups/boardbots-YYYYMMDD.db data/boardbots.db && docker compose up -d'
```

---

## Troubleshooting

### Container won't start

```bash
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml logs boardbots'
```

### Nginx errors

```bash
ssh root@$DROPLET_IP 'tail -f /var/log/nginx/error.log'
```

### WebSocket connection fails

Check that Nginx has proper WebSocket headers in `/etc/nginx/sites-available/boardbots`:
- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`

---

## File Locations (on Droplet)

| File | Location |
|------|----------|
| Source code | /opt/boardbots/src/ |
| docker-compose.yml | /opt/boardbots/docker-compose.yml |
| SQLite database | /opt/boardbots/data/boardbots.db |
| Backups | /opt/boardbots/backups/ |
| Nginx config | /etc/nginx/sites-available/boardbots |

---

## Cost Estimate

- Droplet (s-1vcpu-1gb): **$6/month**
- Bandwidth: Included (1 TB)
- Backups: $0.05/GB/month (optional)

**Total: ~$6/month**

---

## doctl Reference

```bash
# List droplets
doctl compute droplet list

# Get droplet IP
doctl compute droplet get <DROPLET_ID> --format PublicIPv4

# Delete droplet
doctl compute droplet delete <DROPLET_ID>

# SSH into droplet (by name)
doctl compute ssh boardbots

# List regions
doctl compute region list

# List sizes
doctl compute size list
```

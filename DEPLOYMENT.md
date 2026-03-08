# BoardBots Production Deployment

**Last Updated:** 2026-03-07

---

## Production Instance

| Item | Value |
|------|-------|
| **URL** | https://boardbots.benwsmith.com |
| **IP URL** | http://138.197.0.105 |
| **Provider** | DigitalOcean |
| **Region** | NYC3 (New York) |
| **Size** | s-1vcpu-1gb (1GB RAM, 1 vCPU) |
| **Cost** | $6/month |
| **OS** | Ubuntu 24.04 LTS |
| **Droplet ID** | 556702156 |
| **DNS/SSL** | Cloudflare (Universal SSL) |

---

## Infrastructure Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Docker | Container orchestration |
| HTTP Server | Nginx | Reverse proxy, SSL termination |
| App Server | Node.js 22 | Express + WebSocket |
| Database | SQLite | Persistent game state |

---

## Architecture

```
                              ┌─────────────────────────────────────┐
                              │           Cloudflare                │
                              │    (DNS + SSL Termination)          │
                              │                                     │
    User Browser ──HTTPS────►│  boardbots.benwsmith.com            │
                              │       │                             │
                              │       │ (HTTP to origin)            │
                              └───────┼─────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │           DigitalOcean              │
                    │         Droplet (NYC3)              │
                    │                                     │
                    │  Nginx (80)                         │
                    │       │                             │
                    │       ▼                             │
                    │  Docker Container                   │
                    │       │                             │
                    │       ▼                             │
                    │  ┌─────────────────────────────┐   │
                    │  │ Node.js + Express           │   │
                    │  │ - HTTP API                  │   │
                    │  │ - WebSocket Server          │   │
                    │  │ - Static File Serving       │   │
                    │  └─────────────────────────────┘   │
                    │       │                             │
                    │       ▼                             │
                    │  ┌─────────────────────────────┐   │
                    │  │ SQLite (boardbots.db)       │   │
                    │  │ - Game rooms                │   │
                    │  │ - Persistent state          │   │
                    │  └─────────────────────────────┘   │
                    │                                     │
                    └─────────────────────────────────────┘
```

---

## SSH Access

```bash
# Direct SSH
ssh root@138.197.0.105

# Using doctl
doctl compute ssh boardbots
```

---

## Update Process

### Quick Update (code changes only)

```bash
# From project root
DROPLET_IP="138.197.0.105"

# Sync latest code
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.wrangler' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@$DROPLET_IP:/opt/boardbots/src/

# Rebuild and restart
ssh root@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:latest . && cd /opt/boardbots && docker compose up -d'

# Check logs
ssh root@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml logs -f'
```

### Full Update (including dependencies)

```bash
ssh root@$DROPLET_IP 'cd /opt/boardbots && docker compose down'
# Then run quick update process above
```

---

## Monitoring

### Health Check

```bash
curl http://138.197.0.105/api/health
# Expected: OK
```

### Container Status

```bash
ssh root@138.197.0.105 'docker ps'
```

### Logs

```bash
# Application logs
ssh root@138.197.0.105 'docker compose -f /opt/boardbots/docker-compose.yml logs --tail=100'

# Nginx error logs
ssh root@138.197.0.105 'tail -100 /var/log/nginx/error.log'
```

---

## Backup Strategy

### Automatic Backups

Daily backups run at 3 AM UTC via cron:

```bash
# View backup cron job
ssh root@138.197.0.105 'crontab -l'

# List backups
ssh root@138.197.0.105 'ls -la /opt/boardbots/backups/'
```

### Manual Backup

```bash
ssh root@138.197.0.105 'cp /opt/boardbots/data/boardbots.db /opt/boardbots/backups/manual-$(date +%Y%m%d).db'
```

### Restore from Backup

```bash
ssh root@138.197.0.105 'cd /opt/boardbots && docker compose down && cp backups/boardbots-YYYYMMDD.db data/boardbots.db && docker compose up -d'
```

---

## SSL/HTTPS Setup

The production site uses Cloudflare for DNS and SSL termination:

- **Domain:** `boardbots.benwsmith.com`
- **DNS:** Cloudflare (proxied, orange cloud)
- **SSL Mode:** Flexible (Cloudflare terminates HTTPS, connects to origin via HTTP)
- **Certificate:** Cloudflare Universal SSL (covers `*.benwsmith.com`)

### DNS Configuration

| Type | Name | Content | Proxied |
|------|------|---------|---------|
| A | boardbots | 138.197.0.105 | Yes |

### Important Notes

- Use 2-level subdomains (e.g., `boardbots.benwsmith.com`) for Universal SSL coverage
- 3-level subdomains (e.g., `dev.boardbots.benwsmith.com`) are NOT covered by Universal SSL
- For multi-level subdomains, enable Total TLS or use Advanced Certificates

---

## Cost Breakdown

| Item | Monthly Cost |
|------|--------------|
| Droplet (s-1vcpu-1gb) | $6.00 |
| Bandwidth (1 TB included) | $0.00 |
| Backups (optional, $0.05/GB) | ~$0.10 |
| **Total** | **~$6.10/month** |

---

## Troubleshooting

### Site Not Loading

1. Check container is running: `ssh root@138.197.0.105 'docker ps'`
2. Check Nginx: `ssh root@138.197.0.105 'systemctl status nginx'`
3. Check firewall: `ssh root@138.197.0.105 'ufw status'`

### WebSocket Connection Failing

1. Check Nginx config has WebSocket headers
2. Check container logs for errors
3. Verify port 3000 is accessible locally: `ssh root@138.197.0.105 'curl localhost:3000/api/health'`

### Database Issues

1. Check database file exists: `ssh root@138.197.0.105 'ls -la /opt/boardbots/data/'`
2. Restore from backup if corrupted

---

## Emergency Contacts

- **DigitalOcean Support:** https://docs.digitalocean.com/support/
- **Droplet Console:** DigitalOcean Dashboard → Droplets → boardbots → Console

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-08 | Added Cloudflare DNS and SSL for boardbots.benwsmith.com |
| 2026-03-07 | Initial deployment to DigitalOcean |

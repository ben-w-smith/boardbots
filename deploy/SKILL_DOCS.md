# BoardBots Deploy Skill Documentation

## Overview

The deploy skill provides a git-based deployment system for BoardBots to DigitalOcean. It uses `git pull` for code synchronization and Docker for containerized deployment on the production droplet.

**Production URL:** https://boardbots.benwsmith.com/
**Droplet IP:** 138.197.0.105

## Prerequisites

- **doctl CLI** - Installed and authenticated (`doctl auth init`)
- **SSH key** - Uploaded to DigitalOcean account
- **Git access** - Read/write access to the repository
- **.env.deploy** - Configured with droplet credentials (optional - defaults available)

## Commands Reference

### `/deploy`

Main deployment command. Executes the full deployment pipeline:

1. Reads `.env.deploy` for configuration (or uses defaults)
2. Verifies on `main` branch
3. Checks for clean git state (no uncommitted changes)
4. Runs `rsync` to sync code to droplet
5. Executes `git pull` on droplet
6. Builds Docker image with commit SHA tag
7. Creates rollback tag (`previous`)
8. Restarts containers via `docker compose`
9. Runs health verification

**Usage:**
```bash
/deploy
```

### `/deploy status`

Checks the current deployment status:

- Queries `/api/health` endpoint
- Shows deployed commit hash
- Displays container status (running/stopped)
- Shows uptime information

**Usage:**
```bash
/deploy status
```

### `/deploy logs`

Tails docker compose logs from the production droplet:

- Shows real-time logs from all containers
- Optional `--lines N` flag for last N lines
- Follows log output until interrupted

**Usage:**
```bash
/deploy logs
/deploy logs --lines 100
```

### `/deploy rollback`

Reverts to the previous Docker image:

- Stops current container
- Re-tags `boardbots:previous` to `boardbots:latest`
- Restarts containers with previous image
- Verifies health after rollback

**When to use:**
- Deployment introduced a critical bug
- Health checks fail after deploy
- Need quick revert while investigating issues

**Usage:**
```bash
/deploy rollback
```

### `/deploy ssh`

Opens an interactive SSH session to the droplet:

- Uses configured droplet IP from `.env.deploy`
- Connects as `root` user
- Useful for manual debugging and inspection

**Usage:**
```bash
/deploy ssh
```

### `/deploy help`

Displays this documentation.

**Usage:**
```bash
/deploy help
```

## Configuration

### .env.deploy Setup

Create a `.env.deploy` file in the project root:

```bash
# DigitalOcean Droplet Configuration
DROPLET_IP=138.197.0.105
DROPLET_USER=root
DEPLOY_PATH=/opt/boardbots/src
COMPOSE_PATH=/opt/boardbots

# Docker Configuration
IMAGE_NAME=boardbots:latest
CONTAINER_NAME=boardbots

# Health Check
HEALTH_URL=http://138.197.0.105/api/health
```

**Default values are used if any variable is not set.**

## Architecture

```
Local Development                    DigitalOcean Droplet
================                    ====================
                           +------------------+
Source code           +----->  GitHub Remote  |
(git push)            |    +------------------+
                      |             |
                      |             | git pull
                      |             v
                      |      +-------------+
                      |      |   Droplet   |
                      +----->|  (git pull) |
                             +------+------+
                                    |
                          +---------+---------+
                          |                   |
                   +------+------+    +--------+--------+
                   | docker build |    | docker compose  |
                   +------+------+    +--------+--------+
                          |                   |
                          v                   v
                   +-------------+    +------------------+
                   | tagged image|    | container up     |
                   +-------------+    +------------------+
```

## Deployment Flow

1. **Pre-deployment checks**
   - Verify branch is `main`
   - Check git status is clean
   - Confirm droplet is reachable

2. **Code sync**
   - `git fetch origin` on droplet
   - `git checkout origin/main` - updates to latest main

3. **Build**
   - Docker image tagged with commit SHA
   - Previous image tagged as `boardbots:previous`

4. **Deploy**
   - `docker compose down` - Stop containers
   - `docker compose up -d` - Start with new image

5. **Verification**
   - Health endpoint check
   - Container status verification

## File Locations (on Droplet)

| File/Directory | Location |
|----------------|----------|
| Source code | `/opt/boardbots/src/` |
| docker-compose.yml | `/opt/boardbots/docker-compose.yml` |
| SQLite database | `/opt/boardbots/data/boardbots.db` |
| Backups | `/opt/boardbots/backups/` |
| Nginx config | `/etc/nginx/sites-available/boardbots` |
| Nginx logs | `/var/log/nginx/error.log` |
| Deploy lock | `/opt/boardbots/.deploy-lock` |

## Rollback Procedure

### Automatic Rollback

```bash
/deploy rollback
```

### Manual Rollback

```bash
# SSH into droplet
/deploy ssh

# On droplet:
cd /opt/boardbots
docker compose down
docker tag boardbots:previous boardbots:latest
docker compose up -d

# Verify
curl http://localhost:3000/api/health
```

### Database Restore (if needed)

```bash
# SSH into droplet
/deploy ssh

# On droplet:
cd /opt/boardbots
docker compose down
cp backups/boardbots-YYYYMMDD.db data/boardbots.db
docker compose up -d
```

## Troubleshooting

### Issue: Deployment fails with "dirty working tree"

**Cause:** Uncommitted changes in git

**Solution:**
```bash
git status
git commit -am "Save changes"  # or stash
/deploy
```

### Issue: Health check fails after deploy

**Cause:** Application crashed or failed to start

**Solution:**
```bash
/deploy logs
# Check for errors, then:
/deploy rollback  # if critical
```

### Issue: rsync permission denied

**Cause:** SSH key not configured or droplet unreachable

**Solution:**
```bash
# Test SSH connection
ssh root@138.197.0.105

# Verify SSH key is added to DigitalOcean
doctl compute ssh-key list
```

### Issue: Docker build fails on droplet

**Cause:** Incomplete rsync or build dependencies

**Solution:**
```bash
/deploy ssh
cd /opt/boardbots/src
docker build -t boardbots:latest .
# Check error output
```

### Issue: Container won't start

**Cause:** Port conflict or volume mount issue

**Solution:**
```bash
/deploy ssh
docker ps -a
docker logs boardbots
# Check for port conflicts or volume errors
```

### Issue: Database locked

**Cause:** SQLite write lock during restart

**Solution:**
```bash
/deploy ssh
cd /opt/boardbots
docker compose restart
```

## Quick Reference

```bash
# Full deploy
/deploy

# Check status
/deploy status

# View logs
/deploy logs

# Quick rollback
/deploy rollback

# SSH access
/deploy ssh

# Manual health check
curl http://138.197.0.105/api/health
```

## Infrastructure Details

| Component | Value |
|-----------|-------|
| Provider | DigitalOcean |
| Droplet Size | s-1vcpu-1gb ($6/month) |
| OS | Ubuntu 24.04 LTS |
| Runtime | Docker + Node.js 22 |
| Web Server | Nginx (reverse proxy) |
| Database | SQLite (persistent volume) |
| SSL | Let's Encrypt/Certbot |
| Domain | boardbots.benwsmith.com |

## Security Notes

- SSH key authentication required (no password auth)
- Firewall configured for ports 80, 443, SSH only
- Database persisted via Docker volume
- Daily automated backups at 3 AM UTC
- `.env.deploy` should NOT be committed to git

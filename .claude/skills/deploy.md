# Deploy Skill

Deploy BoardBots to DigitalOcean production server.

## Usage

```
/deploy [command]
```

## Commands

| Command | Description |
|---------|-------------|
| `/deploy` | Deploy to production |
| `/deploy status` | Check deployment health and version |
| `/deploy logs [N]` | Tail production logs (last N lines, default 100) |
| `/deploy rollback` | Rollback to previous Docker image |
| `/deploy ssh` | SSH into the droplet |
| `/deploy help` | Show this documentation |

## Prerequisites

Before using this skill, ensure:
1. `doctl` CLI is installed and authenticated (`doctl auth init`)
2. SSH key is uploaded to DigitalOcean
3. `.env.deploy` file exists at project root with configuration
4. You have push access to the GitHub repository

## Configuration

The skill reads configuration from `.env.deploy` at project root:

```bash
DROPLET_IP=138.197.0.105
SSH_USER=root
DOMAIN=boardbots.benwsmith.com
CORS_ORIGIN=https://boardbots.benwsmith.com,http://boardbots.benwsmith.com,http://138.197.0.105
```

## Deployment Process

### `/deploy` - Main Deploy

When the user runs `/deploy`, execute the following:

1. **Load Configuration**
   - Source `.env.deploy` file
   - Validate required variables (DROPLET_IP, SSH_USER)
   - If file missing, prompt user to create it

2. **Pre-deploy Checks**
   - Verify current branch is `main` (exit with error if not, unless `--force` flag)
   - Check for uncommitted changes (warn but allow with `--force`)
   - Verify git push has been done (local commits not pushed = warn)

3. **Deploy Lock**
   - Check for deploy lock on droplet: `/opt/boardbots/.deploy-lock`
   - If lock exists, show lock info and ask user to wait or force remove
   - Create lock file with timestamp

4. **Git Pull on Droplet**
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'cd /opt/boardbots/src && git fetch origin && git checkout origin/main'
   ```

5. **Tag Previous Image (for rollback)**
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'docker tag boardbots:latest boardbots:previous 2>/dev/null || true'
   ```

6. **Build New Image**
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:$(git rev-parse --short HEAD) -t boardbots:latest .'
   ```

7. **Restart Container**
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'cd /opt/boardbots && docker compose down && docker compose up -d'
   ```

8. **Health Check**
   - Wait up to 30 seconds
   - Curl `http://$DROPLET_IP/api/health`
   - If fails, offer to rollback

9. **Release Lock**
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'rm -f /opt/boardbots/.deploy-lock'
   ```

10. **Report Success**
    - Show deployed commit hash
    - Show health check result
    - Show URL: `https://$DOMAIN`

### `/deploy status`

1. Load `.env.deploy`
2. Check health endpoint: `curl -s http://$DROPLET_IP/api/health`
3. Get deployed commit: `ssh $SSH_USER@$DROPLET_IP 'cd /opt/boardbots/src && git rev-parse --short HEAD'`
4. Get container status: `ssh $SSH_USER@$DROPLET_IP 'docker ps --filter name=boardbots'`
5. Report results

### `/deploy logs [N]`

Default N=100 if not specified.

```bash
ssh $SSH_USER@$DROPLET_IP 'docker compose -f /opt/boardbots/docker-compose.yml logs --tail=N -f'
```

Use `-f` for follow mode (Ctrl+C to exit).

### `/deploy rollback`

1. Check if `boardbots:previous` image exists
2. If yes:
   ```bash
   ssh $SSH_USER@$DROPLET_IP 'cd /opt/boardbots && docker compose down && docker tag boardbots:previous boardbots:latest && docker compose up -d'
   ```
3. Verify health
4. Report result

### `/deploy ssh`

Open interactive SSH session:
```bash
ssh $SSH_USER@$DROPLET_IP
```

### `/deploy help`

Show this documentation (read from `deploy/SKILL_DOCS.md` if exists, otherwise this content).

## Error Handling

- **Deploy lock exists**: Show timestamp, ask to wait or force remove
- **Health check fails**: Offer immediate rollback
- **SSH connection fails**: Check network, verify droplet is running
- **Docker build fails**: Show build logs, don't remove previous image
- **Not on main branch**: Error unless `--force` flag provided

## File Locations on Droplet

| Path | Purpose |
|------|---------|
| `/opt/boardbots/src/` | Git repository (source code) |
| `/opt/boardbots/docker-compose.yml` | Docker Compose configuration |
| `/opt/boardbots/data/` | SQLite database persistence |
| `/opt/boardbots/backups/` | Database backups |
| `/opt/boardbots/.deploy-lock` | Deploy lock file |
| `/etc/nginx/sites-available/boardbots` | Nginx configuration |

## Examples

```bash
# Standard deploy
/deploy

# Force deploy from non-main branch
/deploy --force

# Check if deployment is healthy
/deploy status

# Tail recent logs
/deploy logs 50

# Rollback to previous version
/deploy rollback
```

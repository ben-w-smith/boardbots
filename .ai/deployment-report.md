# Deployment Report: Merging `ui/integration` to `main` and Deploying to DigitalOcean

**Generated:** 2026-03-14
**Source Branch:** `ui/integration`
**Target Branch:** `main`
**Production URL:** https://boardbots.benwsmith.com/
**Droplet IP:** http://138.197.0.105

---

## Executive Summary

The `ui/integration` branch contains significant UI improvements including a redesigned landing page, dashboard polish, game view tabs, and design tokens. The branch is **8 commits ahead** of `main` with **2,510 additions** across **15 files**.

**Build Status:** ✅ PASSES (after clean build)
**Unit Tests:** ✅ ALL PASS (108 tests across engine + server)
**E2E Tests:** ✅ ALL PASS (16 tests)

---

## Pre-Deployment Checklist

### 1. Verify Build and Tests

```bash
# Clean previous builds
rm -rf packages/*/dist

# Build all packages
npm run build

# Run unit tests (engine + server)
npm run test --workspace=packages/engine --workspace=packages/server

# Run e2e tests (optional but recommended)
npm run test:e2e
```

### 2. Review Changes

```bash
# View commits being merged
git log main..HEAD --oneline

# View file changes
git diff main --stat
```

**Commits to merge:**
1. `003baaa` - feat: integrate UI changes with tests
2. `00d78a8` - merge: game view tabs
3. `7cf5a84` - merge: dashboard polish
4. `fe5b070` - feat: add tabbed right panel in game view
5. `daa98f9` - feat: dashboard polish improvements
6. `0926832` - feat: dashboard polish improvements
7. `7160d16` - feat: redesign guest landing page with hero section and game explanation
8. `6ad7f44` - feat: implement CSS design tokens and top bar navigation component

**Files changed (15):**
- `CLAUDE.md` - documentation
- `packages/client/src/__tests__/*.test.ts` - test files (4 files)
- `packages/client/src/*.ts` - source files (8 files: dashboard, gameui, lobby, main, topbar, websocket, api/games, auth)
- `packages/client/src/style.css` - major CSS changes (+1,459 lines)
- `packages/server/src/game-room.ts` - server changes

**New untracked files:**
- `packages/client/src/components/TurnControls.svelte` - new Svelte component
- `packages/e2e/tests/ai-game.spec.ts` - new e2e test
- `packages/server/src/__tests__/game-history.test.ts` - new server test

---

## Deployment Plan

### Phase 1: Local Preparation

```bash
# 1. Ensure you're on the integration branch
git checkout ui/integration

# 2. Pull latest changes (if remote exists)
git pull origin ui/integration

# 3. Run full test suite
npm run test
npm run test:e2e

# 4. Build for production
npm run build
```

### Phase 2: Merge to Main

```bash
# 1. Checkout main branch
git checkout main

# 2. Pull latest main (if remote exists)
git pull origin main

# 3. Merge integration branch
git merge ui/integration

# 4. If conflicts occur, resolve them:
# git status  # see conflicted files
# Edit files to resolve conflicts
# git add <resolved-files>
# git commit

# 5. Tag the release (optional)
git tag -a v1.x.x -m "Release: UI integration improvements"

# 6. Push to remote (if applicable)
git push origin main --tags
```

### Phase 3: Deploy to DigitalOcean

#### Option A: Automated Deployment (Recommended)

```bash
# Set droplet IP
DROPLET_IP="138.197.0.105"

# Sync code to droplet (excluding build artifacts)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.wrangler' --exclude '.claude' --exclude '.ai' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@$DROPLET_IP:/opt/boardbots/src/

# Build and restart on droplet
ssh root@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:latest . && cd /opt/boardbots && docker compose down && docker compose up -d'

# Verify health
curl http://$DROPLET_IP/api/health
```

#### Option B: Manual Deployment Steps

```bash
# 1. SSH into droplet
ssh root@138.197.0.105

# 2. Navigate to source directory
cd /opt/boardbots/src

# 3. Pull latest code (if using git on server)
git pull origin main

# 4. Rebuild Docker image
docker build -t boardbots:latest .

# 5. Restart container
cd /opt/boardbots
docker compose down
docker compose up -d

# 6. Check logs
docker compose logs -f

# 7. Verify health
curl http://localhost:3000/api/health
```

---

## Post-Deployment Verification

### Health Checks

```bash
# API health endpoint
curl https://boardbots.benwsmith.com/api/health
# Expected: OK

# Check WebSocket connectivity (browser console)
const ws = new WebSocket('wss://boardbots.benwsmith.com/ws');
ws.onopen = () => console.log('WebSocket connected');
```

### Smoke Tests

1. **Landing Page:** Visit https://boardbots.benwsmith.com - should show hero section
2. **Login Flow:** Test login/register functionality
3. **Game Creation:** Create a new game from dashboard
4. **Game Join:** Join game with code from another browser/incognito
5. **Gameplay:** Place robots, make moves, verify sync

### Log Monitoring

```bash
# Watch container logs
ssh root@138.197.0.105 'docker compose -f /opt/boardbots/docker-compose.yml logs -f'

# Check nginx logs
ssh root@138.197.0.105 'tail -f /var/log/nginx/error.log'
```

---

## Rollback Plan

If deployment fails or issues are found:

```bash
# Option 1: Revert to previous Docker image (if tagged)
ssh root@138.197.0.105 'cd /opt/boardbots && docker compose down && docker tag boardbots:latest boardbots:backup && docker tag boardbots:previous boardbots:latest && docker compose up -d'

# Option 2: Revert git merge locally and redeploy
git checkout main
git revert HEAD  # or git reset --hard HEAD~1
# Re-run deployment steps

# Option 3: Restore database backup
ssh root@138.197.0.105 'cd /opt/boardbots && docker compose down && cp backups/boardbots-YYYYMMDD.db data/boardbots.db && docker compose up -d'
```

---

## Infrastructure Details

| Component | Details |
|-----------|---------|
| **Provider** | DigitalOcean Droplet |
| **IP Address** | 138.197.0.105 |
| **Size** | s-1vcpu-1gb ($6/month) |
| **OS** | Ubuntu 24.04 LTS |
| **Runtime** | Docker + Node.js 22 |
| **Web Server** | Nginx (reverse proxy) |
| **Database** | SQLite (persistent volume) |
| **SSL** | Configured via Let's Encrypt/Certbot |
| **Domain** | boardbots.benwsmith.com |

### File Locations (on Droplet)

| File | Location |
|------|----------|
| Source code | `/opt/boardbots/src/` |
| docker-compose.yml | `/opt/boardbots/docker-compose.yml` |
| SQLite database | `/opt/boardbots/data/boardbots.db` |
| Backups | `/opt/boardbots/backups/` |
| Nginx config | `/etc/nginx/sites-available/boardbots` |

---

## Potential Issues & Solutions

### Issue 1: TypeScript Build Error (Stale Cache)

**Symptom:** `error TS2345: Property 'onResign' is missing`

**Solution:**
```bash
rm -rf packages/*/dist packages/*/node_modules/.cache
npm run build
```

### Issue 2: WebSocket Connection Fails

**Symptom:** Game doesn't sync between players

**Solution:** Verify Nginx WebSocket headers in `/etc/nginx/sites-available/boardbots`:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Issue 3: Database Locked

**Symptom:** SQLite errors in logs

**Solution:**
```bash
ssh root@138.197.0.105 'cd /opt/boardbots && docker compose restart'
```

---

## Notes for AI Agent

1. **No CI/CD Pipeline:** This project does not have GitHub Actions or automated CI. Deployment is manual via rsync/ssh.

2. **No Remote Git:** Currently no git remote is configured on this local repo. If deploying via git push, first set up remote:
   ```bash
   git remote add origin <repository-url>
   ```

3. **Svelte Component:** A new `TurnControls.svelte` file exists but may not be integrated yet. Verify if Svelte is configured in the Vite build.

4. **E2E Tests Take Long:** E2E tests (~16 tests) take ~3 minutes. Plan accordingly if running full suite.

5. **Clean Build Required:** The TypeScript compiler may have stale cache issues. Always run `rm -rf packages/*/dist` before production builds.

---

## Quick Reference Commands

```bash
# Full deployment from scratch
npm run build && npm run test && \
DROPLET_IP="138.197.0.105" && \
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.wrangler' --exclude '.claude' --exclude '.ai' ./ root@$DROPLET_IP:/opt/boardbots/src/ && \
ssh root@$DROPLET_IP 'cd /opt/boardbots/src && docker build -t boardbots:latest . && cd /opt/boardbots && docker compose down && docker compose up -d' && \
curl https://boardbots.benwsmith.com/api/health
```

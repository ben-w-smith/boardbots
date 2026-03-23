# SPEC: E2E-VERIFY - Verify Playwright Test Migration from Worktree

> Generated on 2026-03-21

## 1. Task Summary

**Type**: Operational / Verification
**Priority**: High
**Context**: Completing e2e test migration from `packages/e2e` to `packages/e2e-new`

### Description
The user needs to visually verify that the migrated Playwright tests in `packages/e2e-new` are working correctly by running them locally from the worktree. Currently, services are running from the MAIN repo, not the worktree, which could cause incorrect test results.

### Acceptance Criteria
1. Services (server + client) are stopped from the main repo
2. Services are started fresh from the worktree
3. Playwright tests run successfully from the worktree
4. User can visually confirm test execution via Playwright UI

## 2. Context & Intent

### Why This Matters
- The worktree (`refactor-playwright`) contains the migrated e2e-new test suite
- Services currently running are from the MAIN repo, not the worktree
- Running tests against the wrong codebase could produce false positives/negatives
- Need to ensure the worktree's code is actually being tested

### Current State
| Port | Process | Source | Problem |
|------|---------|--------|---------|
| 3000 | Server (PID 17156) | `/Users/bensmith/development/boardbots/` (main) | Wrong codebase |
| 5174 | Vite (PID 15233) | `/Users/bensmith/development/boardbots/` (main) | Wrong port AND wrong codebase |

### Target State
| Port | Process | Source | Notes |
|------|---------|--------|-------|
| 3000 | Server | Worktree `.claude/worktrees/refactor-playwright/` | Fresh start |
| 5173 | Vite | Worktree `.claude/worktrees/refactor-playwright/` | Correct port |

## 3. Research Findings

### Relevant Files

| File | Purpose |
|------|---------|
| `packages/e2e-new/playwright.config.ts` | Test configuration with webServer settings |
| `packages/server/package.json` | Server dev command: `tsx --watch src/index.ts` |
| `packages/client/package.json` | Client dev command: `vite` (defaults to port 5173) |
| `packages/e2e-new/package.json` | Test scripts including `test:ui` |

### Playwright Configuration Analysis

**webServer settings** (lines 85-100):
```typescript
webServer: [
  {
    command: "npm run dev:test --workspace=packages/server",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,  // ⚠️ KEY: Reuses existing server locally!
  },
  {
    command: "npm run dev --workspace=packages/client",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,  // ⚠️ KEY: Reuses existing server locally!
  },
]
```

**Critical finding**: `reuseExistingServer: !process.env.CI` means:
- Locally: Playwright will **reuse** any already-running servers
- This is the root cause - it will reuse the main repo's servers!

**baseURL** (line 25): `http://localhost:5173`
- Vite is currently on port 5174 (wrong port)
- Needs to be on 5173 for tests to work

### Test Structure

```
packages/e2e-new/
├── tests/
│   ├── critical/     # 16 tests (auth, ai, gameplay, lobby)
│   ├── smoke/        # 5 tests (navigation, pages-load)
│   ├── regression/   # 10 tests (turn-ui, visual)
│   └── setup.spec.ts # Database reset
├── playwright.config.ts
└── package.json
```

### NPM Scripts Available

```json
{
  "test:ui": "playwright test --ui",      // Opens Playwright UI
  "test:ci": "playwright test --project=critical --project=smoke",
  "test:critical": "playwright test --project=critical",
  "test:smoke": "playwright test --project=smoke"
}
```

## 4. Constraints

### Port Requirements
- **Server**: Must run on port 3000 (hardcoded in playwright.config.ts health check)
- **Client**: Must run on port 5173 (baseURL in playwright.config.ts)

### Process Dependencies
- Must kill existing processes before starting new ones
- Both server and client must be running for tests to pass

### Worktree Isolation
- Worktree path: `/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright/`
- All commands must be run from this directory

## 5. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Other agents using main repo services | High | Medium | Confirm with user before killing |
| Vite starts on wrong port (5174) | Medium | High | Ensure no other Vite instance running |
| Database state conflicts | Low | Medium | setup.spec.ts resets DB before tests |

## 6. Success Criteria

- [ ] Existing services (PIDs 17156, 15233) are terminated
- [ ] Server starts from worktree on port 3000
- [ ] Client (Vite) starts from worktree on port 5173
- [ ] Playwright UI launches successfully
- [ ] User visually confirms tests pass in Playwright UI

## 7. Clarifying Questions

Before proceeding with Option A (kill and restart), please confirm:

1. **Is it safe to kill processes 17156 and 15233?** These are running from the main repo. Are any other agents or tasks depending on them?

2. **Should I provide alternative commands for different terminal setups?** (e.g., tmux, separate terminal windows, or background processes)

3. **Do you want the Playwright UI specifically, or would headed mode in terminal also work for visual confirmation?**
   - Playwright UI: `npm run test:ui` (opens browser-based UI)
   - Headed mode: `npm run test:ci -- --headed` (shows browser windows)

---

## 7. Implementation Plan

> Generated on 2026-03-21
>
> **User Preferences Applied**:
> - ✅ Safe to kill main repo processes
> - ✅ Use tmux for multi-pane setup
> - ✅ Use Playwright UI for visual confirmation

### Phase 1: Kill Existing Services

**Goal**: Free up ports and ensure clean state

- [ ] Kill processes on ports 3000 and 5174
  - **Command**: `kill 17156 15233`
  - **Reason**: These are running from the wrong codebase (main repo)
  - **Verification**: `lsof -i :3000 -i :5173 -i :5174 | grep LISTEN` should return nothing

### Phase 2: Create tmux Session

**Goal**: Set up a tmux session with 3 panes for server, client, and tests

- [ ] Create tmux session named "e2e-verify" with 3 panes
  - **Layout**: Horizontal split with test pane on right
  - **Pane assignments**:
    - Pane 0 (top-left): Server
    - Pane 1 (bottom-left): Client (Vite)
    - Pane 2 (right): Playwright UI

### Phase 3: Start Services from Worktree

**Goal**: Launch server and client from the correct codebase

- [ ] Start server on port 3000 (Pane 0)
  - **Command**: `npm run dev --workspace=packages/server`
  - **Working Dir**: `/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright/`
  - **Verification**: Should see "Server listening on port 3000"

- [ ] Start Vite client on port 5173 (Pane 1)
  - **Command**: `npm run dev --workspace=packages/client`
  - **Working Dir**: `/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright/`
  - **Verification**: Should see "Local: http://localhost:5173/"

### Phase 4: Run Playwright UI

**Goal**: Launch Playwright UI for visual test verification

- [ ] Start Playwright UI (Pane 2)
  - **Command**: `cd packages/e2e-new && npm run test:ui`
  - **Working Dir**: `/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright/`
  - **Expected**: Browser opens with Playwright UI

### Phase 5: Visual Verification

**Goal**: User confirms tests work correctly

- [ ] In Playwright UI, run all critical + smoke tests
  - Click "Run all" or select specific test files
  - Verify 21 tests pass (16 critical + 5 smoke)

- [ ] Spot check specific test categories:
  - [ ] Auth tests (register, login, logout)
  - [ ] AI game tests (create AI game, place robot)
  - [ ] Gameplay tests (robot placement, sync)
  - [ ] Lobby tests (create, join, start game)

### Estimated Complexity

- **Files to Modify**: 0 (operational task)
- **Files to Create**: 0
- **Tests to Run**: 21 (critical + smoke)
- **Complexity**: Low
- **Risk Level**: Low

### Risk Mitigation

- **Risk**: Ports still in use after kill
  - **Mitigation**: Use `lsof` to verify ports are free before starting

- **Risk**: tmux session naming conflict
  - **Mitigation**: Use unique session name "e2e-verify"

- **Risk**: Playwright can't connect to services
  - **Mitigation**: Wait for both services to fully start before launching UI

---

## 8. Commands Reference

### Complete tmux Setup Script

Run this single command block from your user directory:

```bash
# Step 1: Kill existing services
kill 17156 15233 2>/dev/null; sleep 1

# Step 2: Create tmux session with 3 panes
tmux new-session -d -s e2e-verify -c "/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright"

# Split into left (60%) and right (40%)
tmux split-window -h -p 40 -t e2e-verify -c "/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright"

# Split left side into top (server) and bottom (client)
tmux split-window -v -t e2e-verify:0.0 -c "/Users/bensmith/development/boardbots/.claude/worktrees/refactor-playwright"

# Pane 0 (top-left): Start server
tmux send-keys -t e2e-verify:0.0 'npm run dev --workspace=packages/server' Enter

# Pane 1 (bottom-left): Start client (after brief delay for server)
tmux send-keys -t e2e-verify:0.1 'sleep 3 && npm run dev --workspace=packages/client' Enter

# Pane 2 (right): Start Playwright UI (after services are ready)
tmux send-keys -t e2e-verify:0.2 'sleep 8 && cd packages/e2e-new && npm run test:ui' Enter

# Attach to session
tmux attach -t e2e-verify
```

### Quick Reference Commands

| Action | Command |
|--------|---------|
| Attach to session | `tmux attach -t e2e-verify` |
| Detach from session | `Ctrl+b` then `d` |
| Kill session | `tmux kill-session -t e2e-verify` |
| Check services | `lsof -i :3000 -i :5173 \| grep LISTEN` |
| Run tests manually | `cd packages/e2e-new && npm run test:ci` |

### Pane Layout

```
┌─────────────────────────┬──────────────────┐
│                         │                  │
│    SERVER (pane 0)      │   PLAYWRIGHT     │
│    port 3000            │   UI (pane 2)    │
│                         │                  │
├─────────────────────────┤                  │
│                         │                  │
│    CLIENT (pane 1)      │                  │
│    port 5173            │                  │
│                         │                  │
└─────────────────────────┴──────────────────┘
```

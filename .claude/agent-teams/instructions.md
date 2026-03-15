# Agent Teams Instructions

> **Status**: EXPERIMENTAL (Beta) - Can be removed when feature stabilizes

## When to Spawn Teammates

**DO spawn teammates for:**
- Parallel work on independent packages (engine, client, server, e2e)
- Code reviews from multiple perspectives (security, performance, coverage)
- Debugging with competing hypotheses
- Cross-layer features spanning frontend/backend/tests

**DON'T spawn teammates for:**
- Sequential tasks with dependencies
- Multiple agents editing the same file
- Simple tasks that don't benefit from parallelization

## BoardBots Package Ownership

To avoid file conflicts, assign teammates to different packages:

| Teammate Role | Owns | Avoids |
|---------------|------|--------|
| `engine-dev` | `packages/engine/**/*.ts` | client, server, e2e |
| `client-dev` | `packages/client/**/*.ts` | engine, server |
| `server-dev` | `packages/server/**/*.ts` | engine, client |
| `e2e-tester` | `packages/e2e/**/*.ts` | src files |

## Spawn Prompts

### Package-Specific Teammates

```
Spawn an engine-dev teammate for packages/engine/.
Focus: pure game logic (hex grid, moves, beam resolution, AI).
Constraints: No I/O dependencies, no client/server imports.
```

```
Spawn a client-dev teammate for packages/client/.
Focus: Vite SPA, canvas renderer, lobby/game UI, WebSocket client.
Dependencies: @lockitdown/engine.
```

```
Spawn a server-dev teammate for packages/server/.
Focus: Express HTTP, ws WebSocket, game rooms, SQLite persistence.
Constraints: Server holds authoritative game state.
```

```
Spawn an e2e-tester teammate for packages/e2e/.
Focus: Playwright tests for lobby, gameplay, multiplayer flows.
```

### Review Teammates

```
Spawn a security-reviewer teammate.
Focus: JWT/token handling, input validation, API security.
Context: App uses JWT in httpOnly cookies.
```

```
Spawn a performance-reviewer teammate.
Focus: Canvas draw calls, WebSocket message frequency, bundle size.
```

## Coordination Guidelines

1. **Task dependencies**: Use task list to block dependent tasks
   - `engine-dev` completes API change → unblocks `client-dev` → unblocks `e2e-tester`

2. **Cross-package types**: Engine changes may require Client/Server updates
   - Spawn engine teammate first, then dependent teammates after

3. **Wait for teammates**: Don't implement tasks yourself while teammates are working
   - Use: "Wait for your teammates to complete their tasks before proceeding"

## Example Team Setups

### Full-Stack Feature
```
Create an agent team to implement [feature].
Spawn 4 teammates: engine-dev, client-dev, server-dev, e2e-tester.
Set up task dependencies so e2e waits for the others.
```

### Parallel Code Review
```
Create an agent team to review PR #[number].
Spawn 3 reviewers: security-reviewer, performance-reviewer,
and one for test coverage.
```

### Hypothesis Testing Debug
```
Users report [bug]. Spawn 3 teammates to investigate different hypotheses.
Have them debate to disprove each other's theories.
```

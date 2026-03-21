# GSD Playwright Workflow Context

**Goal**: Enable spec-driven visual QA where agents write Playwright tests and users verify behavior visually.

**Started**: 2026-03-20

---

## Implementation Phases

### Phase 1: State Settled Event ✅ COMPLETE
**Purpose**: Tests can reliably read `window.gameState` without race conditions

| Task | Status | Notes |
|------|--------|-------|
| Add `gameStateSettled` event to `main.ts` | ✅ | Fires after animations complete |
| Add `getOnComplete()` to `animator.ts` | ✅ | Not needed - used existing `setOnComplete` |
| Add `waitForGameStateSettled()` helper | ✅ | In `packages/e2e/helpers/game.ts` |
| Add `waitForTurn()` helper | ✅ | Convenience for turn-based tests |
| Add `clickHex()` and `getHexPixel()` | ✅ | Phase 2 bonus - already implemented |

### Phase 2: Hex Click Abstraction ✅ COMPLETE
**Purpose**: Tests can click hexes by logical coordinates, not pixels

| Task | Status | Notes |
|------|--------|-------|
| Expose `renderer.getPixelFromHex()` to `window` | ✅ | Already exposed in main.ts |
| Create `clickHex(q, r)` helper | ✅ | Uses renderer's hex-to-pixel conversion |
| Create `getHexPixel(q, r)` helper | ✅ | For visual assertions |

### Phase 3: GameStateBuilder ✅ COMPLETE
**Purpose**: Ergonomic test state setup without verbose JSON

| Task | Status | Notes |
|------|--------|-------|
| Direction string aliases | ✅ | `'E'`, `'SE'`, `'SW'`, `'W'`, `'NW'`, `'NE'` |
| Position aliases | ✅ | `'center'`, `'arena-E'`, `'corridor-S'`, etc. |
| `GameStateBuilder.create().placeRobot().build()` | ✅ | Fluent API in engine/testing |
| `buildTransport()` | ✅ | For seeding via API |
| Preset scenarios | ✅ | `empty`, `twoRobotsFacing`, `lockdownScenario` |
| `seedGameState()` helper | ✅ | In `packages/e2e/helpers/game.ts` |
| `setupSeededGame()` helper | ✅ | High-level convenience function |

### Phase 4: Validate Workflow ✅ COMPLETE
**Purpose**: Confirm the whole pipeline works end-to-end

| Task | Status | Notes |
|------|--------|-------|
| Update `robot-placement.spec.ts` with new helpers | ✅ | Uses clickHex, waitForGameStateSettled |
| Update fixtures to use new helpers | ✅ | waitForAnimations uses waitForGameStateSettled |
| Document the workflow | ⬜ | Update feature-test.md |

---

## Workflow Summary

The GSD Playwright workflow is now functional. Here's how to use it:

### For Writing Tests

```typescript
import { test, expect } from "./fixtures/game";
import { clickHex, waitForGameStateSettled, getGameState } from "../helpers/game.js";

test("my scenario", async ({ gameWithPlayers: { hostPage } }) => {
  // Click hexes using logical coordinates
  await clickHex(hostPage, 0, 5);  // Corridor south

  // Wait for state to settle
  await waitForGameStateSettled(hostPage);

  // Assert on game state
  const state = await getGameState(hostPage) as any;
  expect(state.robots.length).toBe(1);
});
```

### For Seeding State (GameStateBuilder)

```typescript
import { GameStateBuilder } from "@lockitdown/engine";

const transportState = GameStateBuilder.preset('twoRobotsFacing')
  .buildTransport();

await seedGameState(page, gameCode, transportState);
```

### For Visual Verification

Run tests in headed/UI mode:
```bash
npx playwright test --ui          # Interactive test runner
npx playwright test --headed      # Watch browser run tests
```

---

## Remaining Work

1. **Expand POSITIONS in constants.ts** - Add more named positions as needed
2. **Add more preset scenarios** - `midGameConflict`, `endGame`, etc.
3. **Update feature-test.md** - Document workflow for agents

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event approach | Single `gameStateSettled` | No known use case for immediate event |
| Validation | Minimal to start | Add safeguards if it becomes a problem |
| First scenario | Robot placement | Already partially exists |
| Helper location | `packages/e2e/helpers/game.ts` | Consistent with existing structure |

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/client/src/main.ts` | WebSocket handler, dispatch events |
| `packages/client/src/animator.ts` | Animation completion tracking |
| `packages/client/src/renderer.ts` | Hex-to-pixel conversion |
| `packages/e2e/helpers/game.ts` | Test utilities |
| `packages/e2e/tests/robot-placement.spec.ts` | First validation test |

---

## Animation Timing Reference

| Animation | Duration | Notes |
|-----------|----------|-------|
| Robot turn | 200ms | Direction change |
| Robot placement | 250ms | Initial placement |
| Robot advance | 300ms | Movement |
| Lock flash | 400ms | Lockdown effect |
| Destruction | 500ms | Death animation |
| Particles | 600ms | Particle lifetime |

**Max wait for settled**: ~600ms after last state change

# E2E Test Fixes - Prompt for Future Session

## Context

BoardBots is a hex-grid board game with robots, beams, and lockdown mechanics. The project has a Playwright e2e test suite that's experiencing 9 failing tests (25 pass).

## Test Failure Summary

```
9 failed
  - robot-placement.spec.ts: scenario: player places first robot on corridor hex
  - visual.spec.ts: landing page (screenshot mismatch)
  - visual.spec.ts: dashboard (logged in) (screenshot mismatch)
  - visual.spec.ts: lobby waiting for opponent ("Username already taken")
  - visual.spec.ts: game board (empty - waiting phase) ("Username already taken")
```

## Root Causes Identified

### 1. robot-placement.spec.ts - Invalid Fixture Destructuring

**File**: `packages/e2e/tests/scenarios/robot-placement.spec.ts`

**Problem**: The test uses invalid Playwright fixture syntax:
```typescript
// WRONG - Playwright doesn't support nested destructuring in test params
test("...", async ({ gameWithPlayers: { hostPage } }) => {
```

**Correct pattern** (see other passing tests):
```typescript
test("...", async ({ gameWithPlayers }) => {
  const { hostPage } = gameWithPlayers;
```

**Also**: When running via `npx playwright test <file>` standalone, the baseURL from `playwright.config.ts` isn't applied, causing `page.goto("/")` to fail with "Cannot navigate to invalid URL". Tests must be run via `npm run test:e2e` from the e2e package directory.

### 2. visual.spec.ts - Screenshot Mismatches

**Files**:
- `packages/e2e/tests/visual.spec.ts`
- `packages/e2e/tests/visual.spec.ts-snapshots/` (baseline images)

**Problem**: Visual regression tests have screenshot diffs. The baselines may be outdated or the UI has changed.

**Error output shows**:
```
Expected: tests/visual.spec.ts-snapshots/landing-page-visual-regression-darwin.png
Received: test-results/.../landing-actual.png
Diff: test-results/.../landing-diff.png
```

**Fix options**:
1. Update baselines if UI changes are intentional: `npx playwright test --update-snapshots`
2. Investigate the diff images to understand what changed

### 3. visual.spec.ts - Username Already Taken

**File**: `packages/e2e/helpers/auth.ts` (line 52)

**Problem**: Tests register users with timestamps, but running tests multiple times causes collisions:
```typescript
export function generateTestUsername(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `test_${timestamp}_${random}`;
}
```

The visual tests use hardcoded usernames like `VisualHost` and `visual_guest_${Date.now()}` which can collide.

**Error**:
```
Error: Registration failed: Username already taken
at registerUser (/packages/e2e/helpers/auth.ts:52:13)
```

**Fix**: Ensure all tests use `generateTestUsername()` for unique usernames, or add database cleanup between test runs.

---

## Project Structure

```
packages/
  e2e/
    tests/
      scenarios/     # Scenario-based tests
      visual.spec.ts # Visual regression tests
    helpers/
      auth.ts        # Authentication helpers
      game.ts        # Game interaction helpers (clickHex, waitForGameStateSettled, etc.)
      lobby.ts       # Lobby/game creation helpers
    fixtures/
      game.ts        # Playwright fixtures (gameBoard, gameWithPlayers)
    playwright.config.ts
```

## Key Files to Investigate

1. `packages/e2e/tests/scenarios/robot-placement.spec.ts` - Fix destructuring
2. `packages/e2e/fixtures/game.ts` - Understand fixture structure
3. `packages/e2e/tests/visual.spec.ts` - Fix username generation and/or update screenshots
4. `packages/e2e/helpers/auth.ts` - `generateTestUsername()` and `registerUser()`

## How to Run Tests

```bash
# From project root
npm run test:e2e              # Run all e2e tests
npm run test:e2e:ui           # Open Playwright UI

# From packages/e2e directory
npx playwright test                          # Run all tests
npx playwright test --headed                 # Run with visible browser
npx playwright test --update-snapshots       # Update visual baselines
npx playwright test tests/scenarios/...      # Run specific test file
```

## Recent Work Context

This session implemented a GSD (Get Stuff Done) Playwright workflow with:
- `gameStateSettled` event in `main.ts` for reliable state waiting
- `clickHex()` helper for logical coordinate clicks
- `GameStateBuilder` in `@lockitdown/engine/testing` for test state setup
- Test helpers in `packages/e2e/helpers/game.ts`

The `robot-placement.spec.ts` test was updated to use new helpers but has the fixture destructuring bug.

---

## Instructions for the Agent

1. **First**, spawn sub-agents to investigate each failure type in parallel:
   - Agent A: Investigate fixture syntax issue in robot-placement.spec.ts
   - Agent B: Check visual.spec.ts for username collision issues
   - Agent C: Analyze screenshot diffs to determine if update or fix needed

2. **Search the web** for:
   - Playwright fixture parameter destructuring best practices
   - Playwright visual regression test maintenance

3. **Ask clarifying questions** before making changes:
   - Should visual test baselines be updated, or has the UI regressed?
   - Is there a database cleanup mechanism between test runs?

4. **Make targeted fixes** to the identified files

5. **Run tests** to verify fixes: `npm run test:e2e`

## Success Criteria

- All 34 tests pass
- No "Username already taken" errors
- Visual regression tests either pass or have intentional baseline updates

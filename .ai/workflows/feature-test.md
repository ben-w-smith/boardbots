# Feature → Playwright Test Workflow

When asked to build a feature and demonstrate it with a Playwright test, follow these steps:

## 1. Write the Scenario Spec

Create `packages/e2e/scenarios/<feature-name>.md` with:

```markdown
## Scenario: <short description>

**Precondition**: <game phase, player turn, board state>

**Steps**:
1. <user action with hex coordinates or UI element>
2. ...

**Expected State**:
- <gameState assertion>
- ...

**Expected Visual**:
- <what the user should see on screen>
```

Use `packages/e2e/scenarios/BOARD_REFERENCE.md` for hex coordinates.

## 2. Implement the Feature

Make the code changes needed to support the feature. Run `npm run test --workspaces --if-present` to verify nothing is broken.

## 3. Write the Playwright Test

Create `packages/e2e/tests/scenarios/<feature-name>.spec.ts`.

**Required reading before writing tests:**
- `packages/e2e/fixtures/game.ts` — `gameBoard` and `gameWithPlayers` fixtures
- `packages/e2e/helpers/` — auth, lobby, game helpers
- `packages/e2e/.cursor/rules/e2e.mdc` — test patterns and common mistakes

**Key patterns:**
- Use `gameWithPlayers` fixture for two-player scenarios
- Click hex positions via `renderer.getPixelFromHex(q, r)` on the `#gameCanvas`
- Read game state via `page.evaluate(() => (window as any).gameState)`
- Wait for state changes via `page.waitForFunction()`
- Wait for animations via the `gameBoard.waitForAnimations()` fixture method

**Test structure:**
```typescript
import { test, expect } from "../../fixtures/game";

test.describe("<Feature Name>", () => {
  test("<scenario description>", async ({ gameWithPlayers, gameBoard }) => {
    const { hostPage, guestPage } = gameWithPlayers;
    // ... test steps matching the scenario spec
  });
});
```

## 4. Run and Verify

```bash
# Run just the new test
npx playwright test tests/scenarios/<feature-name>.spec.ts --headed

# If it passes, run full suite to check for regressions
npm run test --workspace=packages/e2e
```

If the test fails, fix the issue — don't weaken the assertion.

## 5. Report

Tell the user:
- What the test covers
- How to watch it: `npm run test:headed --workspace=packages/e2e -- tests/scenarios/<feature-name>.spec.ts`
- Any edge cases NOT covered that might need follow-up tests

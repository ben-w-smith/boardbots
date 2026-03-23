---
name: build-gsd
description: GSD Stage - BUILD (BoardBots Project-Specific)
---

# GSD Stage 3: BUILD - Code Execution (BoardBots Project-Specific)

Execute the Implementation Plan step-by-step, writing production-quality code to the file system.

---

## 🔨 WORKFLOW CONTEXT

**You are here**: SPEC ✅ → PLAN ✅ → **BUILD** ← YOU ARE HERE → VERIFY → RETRO

**What happens now**: I'll write **working, production-quality code** based on your plan:
- ✅ Implements core functionality
- ✅ TypeScript compiles with proper types
- ✅ Follows all coding standards and project patterns
- ✅ Writes Playwright tests for features
- ✅ Runs Playwright tests for verification
- ❌ Does NOT create or modify unit test files (that's VERIFY's job)

**What you do next**:
1. Review the Playwright test results
2. Confirm the feature works as expected
3. I commit with your approval

**Expected output**: Working code + passing Playwright tests + manual testing instructions.

---

## Goal

Execute the implementation plan and write production-quality code with Playwright test verification for BoardBots.

## Procedure

### 1. Read Plan and Project Config

```bash
git branch --show-current  # Get ticket ID
cat .claude/rules/gsd-project.mdc  # Get project-specific config (if exists)
```

Read `.claude/plans/[TICKET-ID].md` Section 7: Implementation Plan.

### 2. Pre-Flight Checklist

**MANDATORY: Re-read ALL project rules**:
```bash
ls .claude/rules/*.mdc
```

Ensure code will adhere to:
- Project-specific patterns and conventions
- Import paths, naming conventions, code style
- Playwright testing patterns

### 3. Build Execution Loop

For each implementation step in the plan:

**DO**:
- ✅ Implement business logic
- ✅ Create/modify components, hooks, utilities, services
- ✅ Add TypeScript types (required for compilation)
- ✅ Fix TypeScript compilation errors in NEW code
- ✅ Basic error handling (happy path + known error states)
- ✅ Follow all patterns from .claude/rules/

**DON'T**:
- ❌ Create unit test files (`.spec.ts`, `.test.tsx`, etc.) - that's VERIFY's job
- ❌ Fix pre-existing lint warnings in untouched code
- ❌ Run linting passes
- ❌ Optimize performance (unless required by spec)

### 4. Write Playwright Tests for Features

**When implementing a feature, write Playwright tests that verify the feature works**:

1. **Determine feature area**: Check which files changed and map to feature tags
2. **Create/update test files** in `packages/e2e-new/tests/`:
   - Critical tests for mission-critical flows
   - Smoke tests for basic functionality
3. **Use proper tagging**: `@critical @feature` or `@smoke @feature`
4. **Use test.step()** for organizing test phases
5. **Use existing helpers** from `packages/e2e-new/helpers/`

### 5. Run Playwright Tests

**After implementing the feature, run the relevant Playwright tests**:

```bash
# Get changed files
git diff --name-only

# Run tests for affected feature areas
cd packages/e2e-new && npx playwright test --grep "(@critical|@smoke).*(@feature1|@feature2)" --reporter=list
```

**Or run by project**:
```bash
npx playwright test --project=critical --project=smoke --reporter=list
```

**If tests fail**:
- Analyze the failure
- Either fix the code or fix the test
- Re-run until passing

### 6. TypeScript Check

Run ONLY after all files are written:
```bash
npm run build --workspaces --if-present
```

**Fix Only**:
- TypeScript errors in files YOU modified
- Ignore pre-existing errors in untouched files

### 7. Progress Logging

Append to `.claude/plans/[TICKET-ID].md`:

```markdown
---
## 8. Build Log

> Build started: [timestamp]

| Time | File | Action |
| :--- | :--- | :--- |
| [HH:MM] | `Component.tsx` | Implemented core logic |
| [HH:MM] | `useFeature.ts` | Added hook |
| [HH:MM] | `types.ts` | Added TypeScript definitions |
| [HH:MM] | `tests/critical/feature.spec.ts` | Added Playwright tests |

**Playwright Tests**:
| Project | Tests | Status |
| :--- | :--- | :--- |
| critical | 5 | ✅ PASS |
| smoke | 3 | ✅ PASS |

**TypeScript**: ✅ Compiles / ❌ [N errors remaining]
```

### 8. Build Checkpoint

**STOP and present to user**:

```
## ✅ BUILD Complete

**Modified Files**: [N]
**TypeScript**: ✅ Compiles
**Playwright Tests**: [N passed]

---

## 🧪 Playwright Test Results

**Feature Areas Affected**: `@feature1`, `@feature2`

**Tests Run**: [N] ([N] critical, [N] smoke)

| Status | Test Name |
|--------|-----------|
| ✅ | feature works correctly @critical @feature |
| ✅ | page loads @smoke @feature |
| ... | ... |

**Result**: [N] passed, [N] failed

---

### ❌ Failed Test Details (if any)

**Test**: [test name]
**Error**: [error message]
**Trace**: `npx playwright show-trace test-results/...`

---

## ⚠ CHECKPOINT: Please review the test results

**What was built**:
- [Description of the feature]

**Tests written**:
- [List of Playwright tests created]

**Next steps**:
- ✅ All tests passing → Run `/verify-gsd` to write unit tests, lint, and commit
- ❌ Tests failing → Review failures and fix

If something needs changing, tell me what and I'll update the code.
```

**CRITICAL**: Do NOT proceed to VERIFY automatically. Wait for user confirmation.

---

## BoardBots-Specific Patterns

### Feature Area Tags

When implementing features, determine the appropriate feature tag:

| Feature Area | Files | Tag |
| ------------ | ---- | ---- |
| Auth | `packages/server/src/auth/`, `packages/client/src/auth/` | `@auth` |
| Lobby | `packages/server/src/lobby/`, `packages/client/src/lobby/` | `@lobby` |
| Gameplay | `packages/engine/src/`, `packages/client/src/gameui.ts` | `@gameplay` |
| Multiplayer | `packages/server/src/websocket/`, `packages/client/src/websocket/` | `@multiplayer` |
| AI | `packages/engine/src/ai/` | `@ai` |
| Visual | `packages/client/src/renderer/`, `packages/client/src/animator/` | `@visual` |

### Test File Organization

```
packages/e2e-new/
├── tests/
│   ├── critical/     # @critical tests
│   │   ├── auth.spec.ts
│   │   ├── gameplay.spec.ts
│   │   └── lobby.spec.ts
│   ├── smoke/        # @smoke tests
│   │   ├── pages-load.spec.ts
│   │   └── navigation.spec.ts
│   └── regression/   # @regression tests (edge cases)
```

### Running Tests by Feature

```bash
# Auth feature
cd packages/e2e-new && npx playwright test --grep "(@critical|@smoke).*(@auth)" --reporter=list

# Gameplay feature
cd packages/e2e-new && npx playwright test --grep "(@critical|@smoke).*(@gameplay)" --reporter=list

# All critical + smoke tests (CI)
cd packages/e2e-new && npm run test:ci --reporter=list
```

---

## Important Notes

- **Playwright tests in BUILD**: These verify the feature works for AI-generated code
- **Global test suite**: Run `npm run test:ci` after BUILD to verify nothing broke
- **Unit tests in VERIFY**: Unit tests are written in the VERIFY stage
- **Never auto-commit**: ALWAYS ask permission before committing
- **Test isolation**: Each Playwright test should be independent
- **Helper reuse**: Use existing helpers from `packages/e2e-new/helpers/`

## Exit Conditions

- ✅ **Pass**: All Playwright tests pass, TypeScript compiles, commit message ready
- ⚠ **Partial**: Some tests failing after 5 iterations — present to user
- ❌ **Fail**: Critical issues remain — present blocking issues to user before committing

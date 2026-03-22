---
name: build-gsd-cmux
description: GSD Stage - BUILD (Cmux Browser Testing)
---

# GSD Stage 3: BUILD - Code Execution with Cmux Ad-Hoc Testing

Execute the Implementation Plan step-by-step, then validate with **Cmux browser automation** you can watch in real-time.

---

## WORKFLOW CONTEXT

**You are here**: SPEC -> PLAN -> **BUILD** <- YOU ARE HERE -> VERIFY -> RETRO

**What happens now**: I'll write **working, production-quality code** then **test it live in Cmux**:
- Implements core functionality
- TypeScript compiles with proper types
- **Ad-hoc browser testing via Cmux commands** (you watch in terminal)
- Documents working selectors/timing for VERIFY stage

**What you do next**:
1. Watch the Cmux browser automation happen in your terminal
2. Confirm the feature works visually
3. Tell me:
   - "Looks good" -> Run `/verify-gsd` to codify into Playwright tests
   - "Change X" -> I update the code
   - "This is wrong" -> I revise the approach

**Expected output**: Working code + Cmux test log + your visual confirmation.

**IMPORTANT**: I will NOT write Playwright tests during BUILD. Cmux ad-hoc tests validate the implementation, then VERIFY codifies them into structured tests.

---

## Why Cmux Ad-Hoc Testing?

**Easier for AI reasoning**:
- Linear commands: "Click this, fill that, check result"
- Immediate feedback: `is visible: true` vs parsing Playwright output
- No test framework overhead: No fixtures, imports, test.describe

**Easier for you**:
- Watch it happen in your terminal
- See exactly what selectors work
- Spot timing issues in real-time

**Informs Playwright tests**:
- Document what worked
- VERIFY stage codifies into structured tests
- No guessing at selectors/timing

---

## Procedure

### 1. Read Plan and Project Config

```bash
git branch --show-current  # Get ticket ID
cat .claude/rules/gsd-project.mdc 2>/dev/null || cat AGENTS.md  # Get project config
```

Read `.claude/plans/[TICKET-ID].md` Section 7: Implementation Plan.

### 2. Pre-Flight Checklist

**MANDATORY: Read all project rules**:
```bash
ls .claude/rules/*.mdc 2>/dev/null
cat AGENTS.md
cat packages/*/AGENTS.md  # Package-specific guidance
```

### 3. Build Execution Loop

For each implementation step in the plan:

**DO**:
- Implement business logic
- Create/modify components, hooks, utilities, services
- Add TypeScript types
- Fix TypeScript compilation errors in NEW code
- Basic error handling (happy path + known error states)
- Follow all patterns from AGENTS.md and rules

**DON'T**:
- Create test files (`.spec.ts`, `.test.tsx`, etc.)
- Update existing test files
- Fix pre-existing lint warnings in untouched code
- Run Playwright tests

**If Existing Tests Break**:
Comment them out with a TODO:
```typescript
describe.skip('ComponentName', () => {
  // TODO: Re-enable in VERIFY stage after implementation is confirmed
});
```

### 4. TypeScript Check

Run after all files are written:
```bash
npm run build  # or appropriate build command for this project
```

**Fix Only**:
- TypeScript errors in files YOU modified
- Ignore pre-existing errors in untouched files

### 5. Cmux Ad-Hoc Testing

**This is the key difference from standard BUILD.**

#### 5a. Start Services in Cmux

First, ensure services are running in split panes:

```bash
# Check if cmux socket is available
cmux ping

# List current surfaces to find IDs
cmux list-surfaces --json

# If services not running, start them in splits:
# Split for server
cmux new-split right
cmux send-surface --surface <left-id> "npm run dev --workspace=packages/server"

# Split for client
cmux send-surface --surface <right-id> "cmux new-split down"
cmux send-surface --surface <bottom-right-id> "npm run dev --workspace=packages/client"
```

#### 5b. Open Browser Surface

```bash
# Open a browser surface for testing
cmux browser open http://localhost:5173

# Identify the browser surface ID
cmux browser identify
```

#### 5c. Run Feature-Specific Test Flow

Based on the feature being built, run appropriate Cmux browser commands:

**Pattern for form interactions**:
```bash
# Navigate and wait for load
cmux browser surface:<id> navigate http://localhost:5173
cmux browser surface:<id> wait --load-state complete

# Click element
cmux browser surface:<id> click "#btn-selector"

# Fill form fields
cmux browser surface:<id> fill "#input-selector" --text "value"

# Wait for result
cmux browser surface:<id> wait --text "Success Message"
cmux browser surface:<id> is visible ".result-element"
```

**Pattern for game interactions** (BoardBots-specific):
```bash
# Create game
cmux browser surface:<id> click "#btn-new-game"
cmux browser surface:<id> fill "#game-name" --text "Test Game"
cmux browser surface:<id> click "#btn-create"

# Wait for lobby
cmux browser surface:<id> wait --text "Waiting for players"

# Verify game state
cmux browser surface:<id> snapshot --interactive --compact
```

**Pattern for auth flows**:
```bash
# Register
cmux browser surface:<id> click "#btn-register"
cmux browser surface:<id> fill "#auth-username" --text "testuser_$(date +%s)"
cmux browser surface:<id> fill "#auth-password" --text "TestPass123"
cmux browser surface:<id> fill "#auth-confirm" --text "TestPass123"
cmux browser surface:<id> click "#submit-btn"
cmux browser surface:<id> wait --text "Dashboard"

# Verify logged in
cmux browser surface:<id> is visible ".dashboard-container"
```

#### 5d. Capture Results

After each test flow, capture a snapshot for documentation:
```bash
cmux browser surface:<id> snapshot --compact
cmux browser surface:<id> screenshot --out /tmp/cmux-test-result.png
```

#### 5e. Debug Mode

If something doesn't work:
```bash
# Interactive inspection
cmux browser surface:<id> snapshot --interactive --compact

# Check console for errors
cmux browser surface:<id> console list
cmux browser surface:<id> errors list

# Get current page state
cmux browser surface:<id> get url
cmux browser surface:<id> get title
```

### 6. Document Cmux Test Log

Append to `.claude/plans/[TICKET-ID].md`:

```markdown
---

## 8. Build Log

> Build started: [timestamp]

| Time | File | Action |
| :--- | :--- | :--- |
| [HH:MM] | `Component.ts` | Implemented core logic |
| [HH:MM] | `Hook.ts` | Added hook |
| [HH:MM] | `types.ts` | Added TypeScript definitions |

**TypeScript**: Compiles / [N errors remaining]

---

## 9. Cmux Ad-Hoc Test Log

> Testing completed: [timestamp]

### Test Flow: [Feature Name]

**Commands executed**:
```bash
cmux browser surface:2 click "#btn-register"
cmux browser surface:2 fill "#auth-username" --text "testuser_123456"
cmux browser surface:2 fill "#auth-password" --text "TestPass123"
cmux browser surface:2 fill "#auth-confirm" --text "TestPass123"
cmux browser surface:2 click "#submit-btn"
cmux browser surface:2 wait --text "Dashboard" --timeout-ms 5000
```

**Results**:
- `is visible ".dashboard-container"`: true
- Screenshot saved: `/tmp/cmux-test-result.png`

### Working Selectors Documented

| Action | Selector | Wait/Notes |
| :--- | :--- | :--- |
| Click register button | `#btn-register` | Immediate |
| Fill username | `#auth-username` | Immediate |
| Fill password | `#auth-password` | Immediate |
| Submit form | `#submit-btn` | Immediate |
| Wait for success | `wait --text "Dashboard"` | 5s timeout |
| Verify logged in | `.dashboard-container` | Check visibility |

### Timing Observations

- Page load: ~1s after navigation
- Form submission: ~2s until dashboard visible
- WebSocket connection: ~500ms after page load

### Console Errors (if any)

```
[None / List any errors seen]
```

### Manual Verification Required

- [ ] Visual: Check canvas renders correctly
- [ ] Interaction: Verify click targets are accurate
- [ ] Mobile: Test responsive layout (if applicable)
```

### 7. Build Checkpoint

**STOP and present to user**:

```
BUILD Complete

**Modified Files**: [N]
**TypeScript**: Compiles
**Cmux Ad-Hoc Tests**: [N] flows tested
**Test Log**: Documented in plan file Section 9

---

## Manual Testing Done - Please confirm

**What was tested via Cmux**:
- [Flow 1]: [Result]
- [Flow 2]: [Result]

**What you should verify**:
- Open the Cmux browser surface and interact with the feature
- Check the screenshot at `/tmp/cmux-test-result.png`
- Review the working selectors in Section 9 of the plan

---

**CHECKPOINT: Please confirm the implementation works**

Once confirmed, run `/verify-gsd` to:
- Write Playwright tests using the documented selectors/timing
- Run full test suite
- Run lint
- Generate commit message

If something needs changing, tell me what and I'll update the code.
```

**CRITICAL**: Do NOT proceed to VERIFY automatically. Wait for user confirmation.

---

## Cmux Command Reference

### Navigation
```bash
cmux browser open <url>              # Open new browser surface
cmux browser surface:<id> navigate <url>
cmux browser surface:<id> back
cmux browser surface:<id> reload
```

### Waiting
```bash
cmux browser surface:<id> wait --load-state complete
cmux browser surface:<id> wait --selector "#element"
cmux browser surface:<id> wait --text "Success"
cmux browser surface:<id> wait --url-contains "/dashboard"
```

### Interaction
```bash
cmux browser surface:<id> click "#selector"
cmux browser surface:<id> fill "#selector" --text "value"
cmux browser surface:<id> type "#selector" "text"
cmux browser surface:<id> press Enter
```

### Inspection
```bash
cmux browser surface:<id> snapshot --interactive --compact
cmux browser surface:<id> screenshot --out /tmp/file.png
cmux browser surface:<id> is visible "#selector"
cmux browser surface:<id> get text "#selector"
cmux browser surface:<id> console list
cmux browser surface:<id> errors list
```

### Session State
```bash
cmux browser surface:<id> cookies get
cmux browser surface:<id> storage local get
cmux browser surface:<id> state save /tmp/state.json
```

---

## Error Handling

**Plan Ambiguity**:
- Stop execution
- Ask user for clarification
- Update plan before continuing

**Cmux Test Failure**:
- Use `snapshot --interactive` to inspect page state
- Check console/errors for diagnostic info
- Try alternative selectors
- Document what didn't work in test log

**Services Not Running**:
- Check `cmux list-surfaces` for running terminals
- Start server/client in split panes
- Wait for services to be ready before browser testing

---

## Key Differences from Standard BUILD

| Aspect | Standard BUILD | BUILD-Cmux |
|--------|----------------|------------|
| Manual testing | "You test in browser" | "I test via Cmux commands" |
| Visibility | User opens browser | User watches in terminal |
| Documentation | Informal | Structured test log |
| Selector discovery | Guess or read code | Live testing with commands |
| VERIFY input | "It works" | Full selector/timing log |

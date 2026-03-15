# Problem: Lockdown Chain Resolution

**Status**: investigating
**Priority**: medium
**Created**: 2026-03-14
**Last Updated**: 2026-03-14

## Description

Investigating potential edge cases in beam resolution when multiple robots become locked/unlocked in chain reactions. The resolution algorithm iterates until stable, but there may be edge cases where the order of resolution affects outcomes.

## Background

The beam resolution system in BoardBots has the following outcomes:
- 1 attacker targeting a robot: No effect
- 2 attackers targeting a robot: Lock down (beam disabled)
- 3 attackers targeting a robot: Destroy (remove from board)

The resolution loop iterates until the board state is stable. However, chain reactions can occur when:
1. A locked robot loses an attacker (due to being locked itself)
2. This frees the original robot
3. Which may now target different robots

## Scenarios to Investigate

### Scenario 1: Chain Unlock

```
Initial:
- Robot A targets Robot X
- Robot B targets Robot X
- Robot C targets Robot B

Result: Robot X is locked (2 attackers), Robot B unaffected (1 attacker)

What happens when Robot C gets a second attacker?
- Robot B becomes locked
- Robot B's beam is disabled
- Robot X now has only 1 attacker (Robot A)
- Robot X should unlock

Question: Does the current algorithm handle this correctly?
```

### Scenario 2: Cascade Destruction

```
Initial:
- Robots A, B, C all target Robot X (3 attackers = destroy)
- Robot D also targets Robot B (potential lock)

After X destruction:
- Does D's targeting of B resolve before or after X is removed?
- Order may matter for points allocation
```

### Scenario 3: Active Robot Protection

```
During Robot M's advance move:
- Robot M moves into position where it would be locked by 2 attackers
- Robot M is protected during its own move (skipped in resolution)
- After resolution completes, M's beam is re-enabled

Question: What if M ends up in a position where it's targeted by 2+ attackers?
Should M be locked after its move completes?
```

## Code References

### Key Files

| File | Purpose |
|------|---------|
| `/packages/engine/src/resolution.ts` | Main resolution logic |
| `/packages/engine/src/game.ts` | `applyMove()` orchestrates resolution |
| `/packages/engine/src/__tests__/resolution_lock.test.ts` | Lock/destroy tests |

### Key Functions

```typescript
// resolution.ts
export function resolveMove(state: GameState): void
export function findTargetedRobots(state: GameState): Map<number, number[]>
export function checkForTieBreaks(state: GameState, targeted: Map<number, number[]>): number[]

// game.ts
export function applyMove(state: GameState, move: GameMove): GameState
```

### The Resolution Loop

```typescript
export function resolveMove(state: GameState): void {
  let resolved = false;

  while (!resolved) {
    const targeted = findTargetedRobots(state);

    // Check for tiebreaks first
    const tiebreaks = checkForTieBreaks(state, targeted);
    if (tiebreaks.length > 0) {
      state.requiresTieBreak = true;
      return;
    }

    // Apply outcomes and check if stable
    resolved = updateLockedRobots(state, targeted);
  }
}
```

## Investigation

### Tried

| Date | Approach | Result |
|------|----------|--------|
| 2026-03-14 | Read resolution.ts and test files | Understanding the algorithm |
| 2026-03-14 | Reviewed AGENTS.md patterns | Found two-phase pattern docs |

### Current Understanding

1. The `updateLockedRobots()` function processes all robots and detects if state changed
2. If state changed, `resolved = false` triggers another iteration
3. The loop continues until no changes occur
4. Active robot is skipped during resolution via `_activeRobotPosition` check

### Open Questions

1. **Order of destruction**: When multiple robots are doomed in one iteration, does the order of removal matter?
2. **Point allocation timing**: When exactly are points awarded during destruction?
3. **Tiebreak edge cases**: What happens if tiebreak situation resolves itself during iteration?

## Next Steps

1. Create specific test cases for chain scenarios
2. Add logging to resolution loop to trace iterations
3. Verify behavior matches original Go implementation

## Related Files

- `/packages/engine/src/resolution.ts`
- `/packages/engine/src/game.ts`
- `/packages/engine/src/__tests__/resolution_lock.test.ts`
- `/packages/engine/AGENTS.md`

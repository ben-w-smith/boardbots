# BoardBots Engine - Agent Guide

This document captures the critical patterns that frequently trip up AI agents when modifying this codebase.

## 1. Two-Phase Resolution Pattern (CRITICAL)

During advance/turn moves, the moving robot's beam must stay **OFF** during `resolveMove()`. The engine uses `_activeRobotPosition` tracking to implement this:

**The flow in `applyMove()` (game.ts):**

1. Move execution sets `robot.isBeamEnabled = false` and stores `state._activeRobotPosition`
2. `resolveMove(newState)` runs -- skips the active robot entirely (no lock/destroy, no beam re-enable)
3. **After** resolution: re-enable beam for active robot if not locked (`!isCorridor && !isLockedDown`)
4. Clear `state._activeRobotPosition = undefined`

**Why this matters:** Without this pattern, a robot could be locked/destroyed by beams during its own move, or its beam could re-enable mid-resolution causing cascade effects.

**Implementation detail:** Resolution uses position comparison (`pairEq`) instead of array indices because indices shift when robots are destroyed.

```typescript
// In updateLockedRobots() - skip active robot during resolution
if (activePos && pairEq(robot.position, activePos)) {
  continue;
}
```

## 2. Axial Hex Coordinate System

The game uses **flat-top hexagons** with axial coordinates (q, r):

| File | Function | Purpose |
|------|----------|---------|
| `hex.ts` | `pairDist(a)` | Distance from origin |
| `hex.ts` | `pairEq(a, b)` | Equality check |
| `hex.ts` | `pairAdd(a, b)` | Vector addition |
| `hex.ts` | `pairSub(a, b)` | Vector subtraction |
| `hex.ts` | `pairRotate(p, dir)` | Rotate direction 60 degrees left/right |
| `hex.ts` | `CARDINALS` | Array of 6 direction vectors: [E, SE, SW, W, NW, NE] |

The third cubic axis `s = -q - r` is derived, not stored.

## 3. Beam Resolution Algorithm

`resolveMove()` in `resolution.ts` iterates until stable state:

1. `findTargetedRobots()` -- all robots with enabled beams target the first enemy in their firing line
2. Check for tiebreaks (mutual locks) -- if found, set `requiresTieBreak = true` and return
3. `updateLockedRobots()` applies outcomes:
   - **1 attacker**: No effect, beam stays enabled
   - **2 attackers**: Lock down (`isLockedDown = true`, `isBeamEnabled = false`)
   - **3 attackers**: Destroy robot, award points to attackers
4. Loop until no state changes occur

**Attack axis lookup:** `ATTACK_AXES` map defines which targets are valid for each facing direction. A beam only hits if the target is on the correct axis AND is the closest enemy.

## 4. Key Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Core types: `Pair`, `Robot`, `GameState`, `GameMove` |
| `src/game.ts` | `createGame()`, `applyMove()`, `cloneState()`, transport conversion |
| `src/resolution.ts` | Beam targeting, lock/destroy resolution (iterates until stable) |
| `src/moves.ts` | `possibleMoves()` -- generates all legal moves for current player |
| `src/hex.ts` | Axial hex math utilities |

## 5. Design Principles

- **Pure functions** in utilities -- no side effects
- **Immutability** at API boundary -- `applyMove()` clones state internally
- **Internal mutation** during resolution -- `resolveMove()` mutates the cloned state directly for performance
- **No external dependencies** -- this package is self-contained

## 6. Transport Format Gotchas

The transport format matches Go's JSON serialization for wire compatibility:

- `player` and `playerTurn` are **1-indexed** in transport, **0-indexed** internally
- `robots` is an array of `[position, robotData]` tuples (not a map)
- `status` is `"OnGoing"` or the winner number as a string

## 7. Corridor Rules

- Corridor is at `arenaRadius + 1` hexes from center
- Robots in corridor have beams disabled (`isBeamEnabled = false`)
- Placement only allowed in corridor on first action of turn
- Max 2 robots per player in corridor at once

## 8. Common Mistakes to Avoid

1. **Forgetting to set/clear `_activeRobotPosition`** -- causes resolution to affect the moving robot
2. **Using array indices after destruction** -- indices shift; use position-based lookups
3. **Re-enabling beam before resolution completes** -- breaks the two-phase pattern
4. **Confusing transport vs internal indexing** -- off-by-one errors
5. **Assuming `applyMove()` is pure** -- it clones internally but resolution mutates the clone

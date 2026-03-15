# BoardBots Game Flow

## Game Overview

BoardBots is a 2-player strategy game on a hex grid where players control robots with beam weapons. The goal is to eliminate opponent robots by coordinating attacks.

## Game Phases

```
waiting --> playing --> finished
              |            |
              +------------+
                (rematch)
```

### Phase: Waiting

- Players join the game room
- First player becomes host
- Host can start the game (requires 2 players)
- Host can start AI game (requires 1 human player)

### Phase: Playing

- Players take turns making moves
- Each turn consists of 3 moves
- Turn passes to opponent after 3 moves
- Game ends when a player has <= 2 robots

### Phase: Finished

- Winner is determined
- Players can request rematch
- Game resets to waiting phase

## Robot States

```typescript
interface Robot {
  position: Pair;        // Hex coordinates (q, r)
  direction: Pair;       // Facing direction (one of 6 CARDINALS)
  isBeamEnabled: boolean; // Can fire beam?
  isLockedDown: boolean;  // Disabled by 2 attackers?
  player: number;        // Owner (0 or 1)
}
```

### Key States

| State | isBeamEnabled | isLockedDown | Behavior |
|-------|---------------|--------------|----------|
| Active | true | false | Can move, can fire beam |
| Locked | false | true | Cannot move, cannot fire |
| In Corridor | false | false | Cannot fire (but can move) |

## Move Types

```typescript
type GameMove =
  | { type: 'place'; player: number; position: Pair; direction: Pair }
  | { type: 'advance'; player: number; position: Pair }
  | { type: 'turn'; player: number; position: Pair; direction: 'left' | 'right' };
```

### Place Move

- Adds a new robot to the board
- Only allowed on first action of a turn
- Only allowed in corridor (arenaRadius + 1 from center)
- Max 2 robots per player in corridor at once
- Robot spawns with beam disabled (corridor rule)

### Advance Move

- Moves robot forward one hex in facing direction
- Cannot advance into occupied hex
- Cannot advance into walls
- Robot's beam is disabled during resolution

### Turn Move

- Rotates robot 60 degrees left or right
- Robot's beam is disabled during resolution

## Beam Resolution Algorithm

After each move, the engine resolves beam attacks:

```
1. findTargetedRobots()
   - Each robot with enabled beam targets the closest enemy on its attack axis
   - Attack axis determined by facing direction

2. checkForTieBreaks()
   - If mutual lock situation exists, set requiresTieBreak = true
   - Return and wait for player input

3. updateLockedRobots()
   - 1 attacker: No effect
   - 2 attackers: Lock down target (isLockedDown = true, isBeamEnabled = false)
   - 3 attackers: Destroy target, award points to attackers

4. Loop until stable (no state changes)
```

### Attack Axes

| Facing | Axis Check |
|--------|------------|
| W {-1, 0} | same R, attacker Q > target Q |
| NW {0, -1} | same Q, attacker R > target R |
| NE {1, -1} | same S, attacker R > target R |
| E {1, 0} | same R, attacker Q < target Q |
| SE {0, 1} | same Q, attacker R < target R |
| SW {-1, 1} | same S, attacker Q > target Q |

Where S = -Q - R (derived cubic coordinate).

## Corridor Rules

The corridor is the ring at distance `arenaRadius + 1` from center:

- Robots in corridor have beams disabled
- Placement moves only allowed in corridor
- Max 2 robots per player in corridor
- Moving from corridor into arena re-enables beam (if not locked)

## Win Condition

**Elimination**: A player loses when they have 2 or fewer robots remaining.

The winner is determined by `checkGameOver()` in the engine.

## AI Integration

The engine includes an AI opponent:

```typescript
const result = findBestMove(gameState, playerIndex, depth, timeoutMs?);
// result: { move: GameMove | null, evaluation: number }
```

AI uses minimax with alpha-beta pruning. Depth levels:
- 2: Easy
- 3: Medium (default)
- 4: Hard

## Common Gotchas

1. **Active Robot Protection**: The moving robot is protected during its own move resolution
2. **Index Shifting**: When robots are destroyed, array indices shift. Use position-based lookups.
3. **Transport vs Internal**: Player indices are 1-indexed in transport, 0-indexed internally
4. **Null State**: `gameState` can be null during waiting phase

## Sequence Diagram: Typical Game

```
Player A          Server            Player B           Engine
    |               |                   |                |
    |-- join ------>|                   |                |
    |               |-- join ---------->|                |
    |               |                   |                |
    |-- startGame ->|                   |                |
    |               |-- createGame() ------------------>|
    |<-- gameState -|------------------>|                |
    |               |                   |                |
    |-- move ------>|                   |                |
    |               |-- applyMove() ------------------->|
    |               |<-- newState ------|                |
    |<-- gameState -|------------------>|                |
    |               |                   |                |
    |               |     ... (moves continue)           |
    |               |                   |                |
    |               |-- checkGameOver() --------------->|
    |<-- gameOver --|------------------>|                |
```

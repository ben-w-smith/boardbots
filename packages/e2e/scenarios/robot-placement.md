## Scenario: Player places first robot on corridor hex

**Precondition**: Two-player game, playing phase, player 0's turn, 3 moves remaining, empty board

**Steps**:
1. Player 0 clicks corridor hex (0, 5) — south edge
2. Player 0 clicks direction hex (0, 4) — facing north toward arena center

**Expected State**:
- gameState.robots.length === 1
- Robot at position (0, 5) belongs to player 0
- Robot faces direction (0, -1)
- gameState.playerTurn === 1 (placing consumes entire turn, advances to next player)
- gameState.movesThisTurn === 3 (next player's full turn)

**Expected Visual**:
- Robot sprite visible at hex (0, 5)
- Placement animation plays

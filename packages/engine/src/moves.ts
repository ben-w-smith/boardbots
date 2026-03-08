import type { GameState, GameMove, Pair, TurnDirection } from './types.js';
import { CARDINALS, pairEq, pairAdd, pairDist } from './hex.js';
import { robotAt, isCorridor, robotIndexAt } from './game.js';
import { computeEdges } from './edges.js';

/** Get all possible moves for the current player */
export function possibleMoves(state: GameState): GameMove[] {
  const moves: GameMove[] = [];
  const player = state.playerTurn;

  // Place move: only on first action of turn
  if (state.movesThisTurn === state.gameDef.movesPerTurn) {
    // Check corridor limit
    const robotsInCorridor = state.robots.filter(
      (r) => r.player === player && isCorridor(state, r.position)
    ).length;

    if (robotsInCorridor <= 1) {
      // Get valid placement positions from edges
      // Corridor is at arenaRadius + 1
      const placements = computeEdges(state.gameDef.board.hexaBoard.arenaRadius + 1);

      for (const placement of placements) {
        // Must not have a robot already at this position
        if (!robotAt(state, placement.position)) {
          moves.push({
            type: 'place',
            player,
            position: placement.position,
            direction: placement.direction,
          });
        }
      }
    }
  }

  // Advance and Turn moves for each robot the player owns
  for (const robot of state.robots) {
    if (robot.player !== player) continue;

    // Advance: only if not locked down and destination is empty and within bounds
    if (!robot.isLockedDown) {
      const dest = pairAdd(robot.position, robot.direction);
      const arenaRadius = state.gameDef.board.hexaBoard.arenaRadius;
      const corridorRadius = arenaRadius + 1;
      const destDist = pairDist(dest);

      if (!robotAt(state, dest) && destDist <= corridorRadius) {
        moves.push({
          type: 'advance',
          player,
          position: robot.position,
        });
      }
    }

    // Turn: always available (left or right)
    moves.push({
      type: 'turn',
      player,
      position: robot.position,
      direction: 'left' as TurnDirection,
    });
    moves.push({
      type: 'turn',
      player,
      position: robot.position,
      direction: 'right' as TurnDirection,
    });
  }

  return moves;
}

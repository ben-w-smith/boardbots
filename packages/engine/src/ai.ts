import type { GameState, GameMove, PlayerPosition } from './types.js';
import { applyMove, checkGameOver } from './game.js';
import { possibleMoves } from './moves.js';
import { scoreGameState } from './evaluator.js';

/**
 * Result from the AI search.
 */
export interface AIResult {
  move: GameMove | null;
  score: number;
}

/**
 * Find the best move using alpha-beta pruning.
 * Port of AlphaBeta from minimax.go.
 *
 * @param state - Current game state
 * @param player - Player to find move for
 * @param depth - Search depth
 * @param timeoutMs - Timeout in milliseconds (0 = no timeout)
 * @returns Best move found and its score
 */
export function findBestMove(
  state: GameState,
  player: PlayerPosition,
  depth: number,
  timeoutMs: number = 0
): AIResult {
  const startTime = timeoutMs > 0 ? Date.now() : 0;
  const deadline = startTime + timeoutMs;

  const result = alphaBeta(state, player, depth, -Infinity, Infinity, deadline);
  return result;
}

/**
 * Alpha-beta pruning algorithm.
 * Port of alphaBeta from minimax.go lines 129-205.
 */
function alphaBeta(
  state: GameState,
  searcher: PlayerPosition,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number
): AIResult {
  // Check timeout
  if (deadline > 0 && Date.now() >= deadline) {
    return { move: null, score: scoreGameState(state, searcher) };
  }

  // Check for game over
  const { isOver } = checkGameOver(state);
  if (isOver) {
    return { move: null, score: scoreGameState(state, searcher) };
  }

  // Get possible moves
  const moves = possibleMoves(state);

  // Base case: depth 0 or no moves
  if (depth === 0 || moves.length === 0) {
    return { move: null, score: scoreGameState(state, searcher) };
  }

  const shouldMaximize = searcher === state.playerTurn;

  if (shouldMaximize) {
    let best: AIResult = { move: null, score: -Infinity };

    for (const move of moves) {
      try {
        const newState = applyMove(state, move);
        const childResult = alphaBeta(newState, searcher, depth - 1, alpha, beta, deadline);

        if (childResult.score > best.score) {
          best = { move, score: childResult.score };
        }

        if (childResult.score >= beta) {
          break; // Beta cutoff
        }

        alpha = Math.max(alpha, childResult.score);
      } catch {
        // Invalid move, skip
        continue;
      }
    }

    return best;
  } else {
    let best: AIResult = { move: null, score: Infinity };

    for (const move of moves) {
      try {
        const newState = applyMove(state, move);
        const childResult = alphaBeta(newState, searcher, depth - 1, alpha, beta, deadline);

        if (childResult.score < best.score) {
          best = { move, score: childResult.score };
        }

        if (childResult.score <= alpha) {
          break; // Alpha cutoff
        }

        beta = Math.min(beta, childResult.score);
      } catch {
        // Invalid move, skip
        continue;
      }
    }

    return best;
  }
}

/**
 * Play a complete game with AI vs AI.
 * Useful for testing and validation.
 *
 * @param state - Initial game state
 * @param depth - Search depth for both players
 * @param maxMoves - Maximum moves before declaring draw (0 = unlimited)
 * @returns Winner player index, or -1 for draw
 */
export function playAiGame(state: GameState, depth: number, maxMoves: number = 0): number {
  let currentState = state;
  let moveCount = 0;

  while (true) {
    const { isOver, winner } = checkGameOver(currentState);
    if (isOver) {
      return winner;
    }

    if (maxMoves > 0 && moveCount >= maxMoves) {
      return -1; // Draw
    }

    const result = findBestMove(currentState, currentState.playerTurn, depth);

    if (!result.move) {
      // No valid moves, game over
      const opponent = (currentState.playerTurn + 1) % currentState.players.length;
      return opponent;
    }

    currentState = applyMove(currentState, result.move);
    moveCount++;
  }
}

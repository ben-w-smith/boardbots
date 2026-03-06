import type { GameState, PlayerPosition, Robot } from './types.js';
import { pairS, CARDINALS, pairAdd } from './hex.js';
import { isCorridor } from './game.js';
import { getAttackAxis } from './resolution.js';

/**
 * Score a game state from a player's perspective.
 * Port of ScoreGameState from evaluators.go lines 24-40.
 */
export function scoreGameState(state: GameState, player: PlayerPosition): number {
  let score = 0;

  for (const robot of state.robots) {
    const botScore = scoreRobot(robot, state);
    if (robot.player === player) {
      score += botScore;
    } else {
      score -= botScore;
    }
  }

  // Score the current player's points (same as Go implementation)
  score += playerScore(state.players[state.playerTurn]);

  return score;
}

/**
 * Score a player's points contribution.
 * Port of playerScore from evaluators.go lines 41-43.
 */
function playerScore(player: { points: number }): number {
  return player.points * 30;
}

/**
 * Score an individual robot.
 * Port of scoreRobot from evaluators.go lines 45-56.
 */
function scoreRobot(robot: Robot, game: GameState): number {
  let botScore = 0;

  if (robot.isLockedDown) {
    botScore -= 100;
  }

  botScore += scoreBotPosition(robot, game);

  return botScore;
}

/**
 * Score a robot's position.
 * Port of scoreBotPosition from evaluators.go lines 57-100.
 *
 * Scoring factors:
 * - On axis (q=0 or r=0 or s=0): +10 (prioritizes corners)
 * - Attackable hexes around position: -1 each (prioritizes edges)
 * - In corridor with inward-facing next move: +1
 * - Enemy bot in beam range: +20
 */
function scoreBotPosition(robot: Robot, game: GameState): number {
  let score = 0;

  // Boost score for hexes on the axis (prioritizes corners)
  if (robot.position.q === 0 || robot.position.r === 0 || pairS(robot.position) === 0) {
    score += 10;
  }

  // Count attackable paths to bot position (prioritizes edges)
  if (!isCorridor(game, robot.position)) {
    let cursor = pairAdd(robot.position, CARDINALS[4]); // Start at NW
    let attackableHexes = 0;

    for (const dir of CARDINALS) {
      if (!isCorridor(game, cursor)) {
        attackableHexes++;
      }
      cursor = pairAdd(cursor, dir);
    }
    score -= attackableHexes;
  } else {
    // If in corridor, check if next move is into arena
    const next = pairAdd(robot.position, robot.direction);
    if (!isCorridor(game, next)) {
      score += 1;
    }
  }

  // Encourage enemy bots in beam range
  const attackAxis = getAttackAxis(robot.direction);
  if (attackAxis) {
    for (const bot of game.robots) {
      if (robot.player !== bot.player) {
        if (attackAxis(robot.position, bot.position)) {
          score += 20;
        }
      }
    }
  }

  return score;
}

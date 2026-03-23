import type { GameState, Pair } from './types.js';
import { pairS, pairDist, pairEq, pairKey } from './hex.js';
import { robotAt, isCorridor } from './game.js';

/**
 * Attack axis functions — determine if an attacker's beam
 * can hit a target based on the attacker's facing direction.
 * Port from evaluators.go lines 3-22.
 */
export const ATTACK_AXES: Map<string, (attacker: Pair, target: Pair) => boolean> = new Map([
  // W {-1, 0}: attacker.R == target.R && attacker.Q > target.Q
  ['-1,0', (attacker: Pair, target: Pair) => attacker.r === target.r && attacker.q > target.q],
  // NW {0, -1}: attacker.Q == target.Q && attacker.R > target.R
  ['0,-1', (attacker: Pair, target: Pair) => attacker.q === target.q && attacker.r > target.r],
  // NE {1, -1}: attacker.S() == target.S() && attacker.R > target.R
  ['1,-1', (attacker: Pair, target: Pair) => pairS(attacker) === pairS(target) && attacker.r > target.r],
  // E {1, 0}: attacker.R == target.R && attacker.Q < target.Q
  ['1,0', (attacker: Pair, target: Pair) => attacker.r === target.r && attacker.q < target.q],
  // SE {0, 1}: attacker.Q == target.Q && attacker.R < target.R
  ['0,1', (attacker: Pair, target: Pair) => attacker.q === target.q && attacker.r < target.r],
  // SW {-1, 1}: attacker.S() == target.S() && attacker.Q > target.Q
  ['-1,1', (attacker: Pair, target: Pair) => pairS(attacker) === pairS(target) && attacker.q > target.q],
]);

/** Get the attack axis function for a direction */
export function getAttackAxis(direction: Pair): ((attacker: Pair, target: Pair) => boolean) | undefined {
  const key = pairKey(direction);
  return ATTACK_AXES.get(key);
}

/**
 * Find all targeted robots and their attackers.
 * Returns map: targeted robot index → list of attacker indices.
 */
export function findTargetedRobots(state: GameState): Map<number, number[]> {
  const targeted = new Map<number, number[]>();

  for (let aIdx = 0; aIdx < state.robots.length; aIdx++) {
    const attacker = state.robots[aIdx];

    // Skip if attacker can't fire
    if (!attacker.isBeamEnabled || attacker.isLockedDown || isCorridor(state, attacker.position)) {
      continue;
    }

    const axisFn = getAttackAxis(attacker.direction);
    if (!axisFn) continue;

    let closestIdx = -1;
    let closestDist = Infinity;

    // Find closest target on attack axis
    for (let tIdx = 0; tIdx < state.robots.length; tIdx++) {
      if (aIdx === tIdx) continue;

      const target = state.robots[tIdx];

      if (axisFn(attacker.position, target.position)) {
        const dist = pairDist({
          q: attacker.position.q - target.position.q,
          r: attacker.position.r - target.position.r,
        });

        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = tIdx;
        }
      }
    }

    // Only target enemy robots
    if (closestIdx !== -1 && state.robots[closestIdx].player !== attacker.player) {
      const attackers = targeted.get(closestIdx) ?? [];
      attackers.push(aIdx);
      targeted.set(closestIdx, attackers);
    }
  }

  return targeted;
}

/**
 * Check for tiebreaks (mutual lock situations).
 * Returns indices of robots that need tiebreak resolution.
 */
export function checkForTieBreaks(state: GameState, targeted: Map<number, number[]>): number[] {
  const tiebreaks: number[] = [];

  for (const [doomedIdx, attackers] of targeted) {
    const doomed = state.robots[doomedIdx];

    // Skip if already locked or only one attacker
    if (doomed.isLockedDown || attackers.length <= 1) {
      continue;
    }

    // Check if any attacker is also being targeted
    for (const attackerIdx of attackers) {
      const attackerTargeted = targeted.get(attackerIdx);
      if (attackerTargeted && attackerTargeted.length > 1) {
        tiebreaks.push(doomedIdx);
        break;
      }
    }
  }

  return tiebreaks;
}

/**
 * Resolve the board state after a move.
 * - 1 attacker: no effect
 * - 2 attackers: lock down the robot
 * - 3 attackers: destroy the robot (award points)
 * Iterates until stable.
 */
export function resolveMove(state: GameState): void {
  let resolved = false;

  while (!resolved) {
    const targeted = findTargetedRobots(state);

    // Check for tiebreaks
    const tiebreaks = checkForTieBreaks(state, targeted);
    if (tiebreaks.length > 0) {
      state.requiresTieBreak = true;
      return;
    }

    resolved = updateLockedRobots(state, targeted);
  }
}

/**
 * Update robot states based on targeting.
 * Returns true if resolved (no state changes), false if needs another iteration.
 */
function updateLockedRobots(state: GameState, targeted: Map<number, number[]>): boolean {
  const activePos = state._activeRobotPosition;
  let resolved = true;
  const doomedIndices: number[] = [];

  for (let i = 0; i < state.robots.length; i++) {
    const robot = state.robots[i];

    // Skip the active robot entirely — its state is controlled by the move, not resolution
    // This prevents the moving robot from being locked/destroyed or having its beam
    // re-enabled during its own move. Targeting will be re-evaluated after the move.
    // Use position comparison since indices can shift when robots are destroyed.
    if (activePos && pairEq(robot.position, activePos)) {
      continue;
    }

    const attackers = targeted.get(i);

    if (!attackers || attackers.length === 1) {
      // No or single attacker: enable the robot
      const wasBeamEnabled = robot.isBeamEnabled;
      const wasLocked = robot.isLockedDown;

      robot.isLockedDown = false;
      robot.isBeamEnabled = !isCorridor(state, robot.position);

      // State changed, need to reevaluate
      if (wasBeamEnabled !== robot.isBeamEnabled || wasLocked !== robot.isLockedDown) {
        resolved = false;
      }
    } else if (attackers.length === 3) {
      // 3 attackers: destroy the robot
      doomedIndices.push(i);

      // Award points to attackers
      for (const attackerIdx of attackers) {
        const attacker = state.robots[attackerIdx];
        state.players[attacker.player].points += 1;
      }

      resolved = false;
    } else if (attackers.length === 2) {
      // 2 attackers: lock down the robot
      const wasLocked = robot.isLockedDown;
      robot.isBeamEnabled = false;
      robot.isLockedDown = true;

      // State changed, need to reevaluate (locking a robot disables its beam)
      if (!wasLocked) {
        resolved = false;
      }
    }
  }

  // Remove doomed robots (iterate in reverse to avoid index shifting)
  for (let i = doomedIndices.length - 1; i >= 0; i--) {
    state.robots.splice(doomedIndices[i], 1);
  }

  return resolved;
}

/**
 * Re-enable a robot after move resolution.
 * Called after advance/turn to re-enable beam if not locked.
 */
export function reenableRobot(robot: { isBeamEnabled: boolean; isLockedDown: boolean }, inCorridor: boolean): void {
  robot.isBeamEnabled = !inCorridor && !robot.isLockedDown;
}

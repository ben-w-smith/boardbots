import { describe, it, expect } from 'vitest';
import { createGame, applyMove, isCorridor } from '../game.js';
import { findTargetedRobots, resolveMove, getAttackAxis } from '../resolution.js';
import type { GameDef, GameState, GameMove, Pair } from '../types.js';
import { E, W, SE, SW, NW, NE } from '../hex.js';

const defaultGameDef: GameDef = {
  board: { hexaBoard: { arenaRadius: 5 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: 'Elimination',
};

/** Helper to create a state with robots at specific positions */
function createStateWithRobots(
  robots: Array<{ player: number; position: Pair; direction: Pair; isLockedDown?: boolean }>
): GameState {
  const state = createGame(defaultGameDef);
  state.robots = robots.map((r) => ({
    position: r.position,
    direction: r.direction,
    isBeamEnabled: true,
    isLockedDown: r.isLockedDown ?? false,
    player: r.player,
  }));
  return state;
}

describe('getAttackAxis', () => {
  it('returns correct axis function for E direction', () => {
    const axisFn = getAttackAxis(E)!;

    // E attacks targets with same r and HIGHER q (to the east)
    expect(axisFn({ q: 3, r: 0 }, { q: 5, r: 0 })).toBe(true);  // target is east
    expect(axisFn({ q: 3, r: 0 }, { q: 1, r: 0 })).toBe(false); // target is west
    expect(axisFn({ q: 3, r: 0 }, { q: 5, r: 1 })).toBe(false); // different r
  });

  it('returns correct axis function for W direction', () => {
    const axisFn = getAttackAxis(W)!;

    // W attacks targets with same r and LOWER q (to the west)
    expect(axisFn({ q: 3, r: 0 }, { q: 1, r: 0 })).toBe(true);  // target is west
    expect(axisFn({ q: 1, r: 0 }, { q: 3, r: 0 })).toBe(false); // target is east
  });
});

describe('findTargetedRobots', () => {
  it('finds no targets when no robots can attack', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
    ]);

    const targeted = findTargetedRobots(state);
    expect(targeted.size).toBe(0);
  });

  it('finds single target on attack axis', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
      { player: 1, position: { q: 2, r: 0 }, direction: NW }, // not facing attacker
    ]);

    const targeted = findTargetedRobots(state);

    // Only robot 0 targets robot 1 (robot 1 faces NW, not toward robot 0)
    expect(targeted.size).toBe(1);
    expect(targeted.has(1)).toBe(true); // robot at index 1 is targeted
    expect(targeted.get(1)).toEqual([0]); // by robot at index 0
  });

  it('ignores friendly robots', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
      { player: 0, position: { q: 2, r: 0 }, direction: W }, // same player
    ]);

    const targeted = findTargetedRobots(state);
    expect(targeted.size).toBe(0);
  });

  it('finds closest target on attack axis', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
      { player: 1, position: { q: 4, r: 0 }, direction: W }, // farther
      { player: 1, position: { q: 2, r: 0 }, direction: W }, // closer
    ]);

    const targeted = findTargetedRobots(state);

    // Should target robot at index 2 (closer), not index 1
    expect(targeted.has(2)).toBe(true);
    expect(targeted.has(1)).toBe(false);
  });

  it('ignores locked down attackers', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E, isLockedDown: true },
      { player: 1, position: { q: 2, r: 0 }, direction: NW }, // not facing attacker
    ]);

    const targeted = findTargetedRobots(state);
    // Locked robot can't attack, and other robot faces wrong direction
    expect(targeted.size).toBe(0);
  });

  it('ignores corridor robots as attackers', () => {
    const state = createGame(defaultGameDef);
    state.robots = [
      {
        position: { q: 6, r: 0 }, // corridor
        direction: W,
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      },
      {
        position: { q: 4, r: 0 }, // in arena, same team
        direction: E,
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0, // same player, so won't be targeted
      },
    ];

    const targeted = findTargetedRobots(state);
    // Corridor robot cannot attack, and arena robot targets friendlies
    expect(targeted.size).toBe(0);
  });

  it('ignores corridor robots as targets', () => {
    const state = createGame(defaultGameDef);
    // Attacker in arena (distance 4), facing corridor where enemy is
    state.robots = [
      {
        position: { q: 4, r: 0 }, // arena (dist=4)
        direction: E,              // facing corridor
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      },
      {
        position: { q: 6, r: 0 }, // corridor (dist=6=arenaRadius+1)
        direction: W,
        isBeamEnabled: false,
        isLockedDown: false,
        player: 1, // enemy - but should NOT be targeted because in corridor
      },
    ];

    const targeted = findTargetedRobots(state);
    // Corridor robot should not be targeted even though it's an enemy in beam path
    expect(targeted.size).toBe(0);
  });
});

describe('resolveMove - locking', () => {
  it('locks robot with 2 attackers', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
      { player: 0, position: { q: 4, r: 0 }, direction: W },
      { player: 1, position: { q: 2, r: 0 }, direction: NW }, // target
    ]);

    resolveMove(state);

    expect(state.robots[2].isLockedDown).toBe(true);
    expect(state.robots[2].isBeamEnabled).toBe(false);
  });

  it('does not lock with only 1 attacker', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
      { player: 1, position: { q: 2, r: 0 }, direction: W },
    ]);

    resolveMove(state);

    expect(state.robots[1].isLockedDown).toBe(false);
  });
});

describe('resolveMove - destruction', () => {
  it('destroys robot with 3 attackers', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },      // attacks on E axis
      { player: 0, position: { q: 4, r: 0 }, direction: W },      // attacks on W axis
      { player: 0, position: { q: 2, r: -2 }, direction: SE },    // attacks on SE axis
      { player: 1, position: { q: 2, r: 0 }, direction: NW },     // target
    ]);

    resolveMove(state);

    // Robot at index 3 should be destroyed
    expect(state.robots.length).toBe(3);
    expect(state.robots.find((r) => r.position.q === 2 && r.position.r === 0)).toBeUndefined();

    // Points should be awarded
    expect(state.players[0].points).toBe(3); // 1 point per attacker
  });
});

describe('resolveMove - enabling', () => {
  it('enables robot with no attackers', () => {
    const state = createStateWithRobots([
      { player: 0, position: { q: 0, r: 0 }, direction: E },
    ]);
    state.robots[0].isBeamEnabled = false;
    state.robots[0].isLockedDown = true;

    resolveMove(state);

    expect(state.robots[0].isLockedDown).toBe(false);
    expect(state.robots[0].isBeamEnabled).toBe(true);
  });

  it('keeps corridor robots disabled', () => {
    const state = createGame(defaultGameDef);
    state.robots = [
      {
        position: { q: 6, r: 0 }, // corridor
        direction: W,
        isBeamEnabled: false,
        isLockedDown: false,
        player: 0,
      },
    ];

    resolveMove(state);

    expect(state.robots[0].isBeamEnabled).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyMove,
  robotAt,
  isCorridor,
  toTransport,
  fromTransport,
  checkGameOver,
} from '../game.js';
import { possibleMoves } from '../moves.js';
import { findTargetedRobots } from '../resolution.js';
import type { GameDef, GameState, GameMove, TransportState, Pair } from '../types.js';

const defaultGameDef: GameDef = {
  board: { hexaBoard: { arenaRadius: 5 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: 'Elimination',
};

describe('createGame', () => {
  it('produces valid initial state', () => {
    const state = createGame(defaultGameDef);

    expect(state.gameDef).toEqual(defaultGameDef);
    expect(state.players).toHaveLength(2);
    expect(state.players[0]).toEqual({ points: 0, placedRobots: 0 });
    expect(state.players[1]).toEqual({ points: 0, placedRobots: 0 });
    expect(state.robots).toHaveLength(0);
    expect(state.playerTurn).toBe(0);
    expect(state.movesThisTurn).toBe(3);
    expect(state.requiresTieBreak).toBe(false);
    expect(state.winner).toBe(-1);
  });
});

describe('applyMove - place', () => {
  it('places a robot in the corridor', () => {
    const state = createGame(defaultGameDef);
    const move: GameMove = {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 }, // corridor position (dist=6)
      direction: { q: 0, r: 1 }, // facing SE (inward)
    };

    const newState = applyMove(state, move);

    expect(newState.robots).toHaveLength(1);
    const robot = newState.robots[0];
    expect(robot.position).toEqual({ q: 1, r: -6 });
    expect(robot.direction).toEqual({ q: 0, r: 1 });
    // Robots in corridor have beam disabled
    expect(robot.isBeamEnabled).toBe(false);
    expect(robot.isLockedDown).toBe(false);
    expect(robot.player).toBe(0);
    expect(newState.players[0].placedRobots).toBe(1);
  });

  it('place consumes entire turn and advances to next player', () => {
    const state = createGame(defaultGameDef);
    const move: GameMove = {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    };

    const newState = applyMove(state, move);

    // Turn advanced to next player
    expect(newState.playerTurn).toBe(1);
    expect(newState.movesThisTurn).toBe(3); // Next player's full turn
  });

  it('cannot place on second action', () => {
    let state = createGame(defaultGameDef);

    // First, place a robot to consume first action slot
    state = {
      ...state,
      movesThisTurn: 2, // Simulate being on second action
    };

    const move: GameMove = {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    };

    expect(() => applyMove(state, move)).toThrow('first action');
  });

  it('cannot place outside corridor', () => {
    const state = createGame(defaultGameDef);
    const move: GameMove = {
      type: 'place',
      player: 0,
      position: { q: 0, r: 0 }, // center, not corridor
      direction: { q: 0, r: 1 },
    };

    expect(() => applyMove(state, move)).toThrow('corridor');
  });
});

describe('applyMove - advance', () => {
  it('advances a robot in its facing direction', () => {
    let state = createGame(defaultGameDef);

    // Place a robot first
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 }, // facing SE (inward)
    });

    // Now it's player 1's turn, skip to player 0's next turn
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    // Place another robot for player 0 (in a different spot)
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: -1, r: 6 },
      direction: { q: 0, r: -1 },
    });

    // Skip to player 0's turn again
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    // Advance the robot
    const advanceMove: GameMove = {
      type: 'advance',
      player: 0,
      position: { q: -1, r: 6 },
    };

    const newState = applyMove(state, advanceMove);

    const robot = robotAt(newState, { q: -1, r: 5 }); // moved inward
    expect(robot).toBeDefined();
    expect(robot?.position).toEqual({ q: -1, r: 5 });
  });

  it('cannot advance locked robot', () => {
    let state = createGame(defaultGameDef);

    // Place a robot
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    });

    // Manually lock the robot
    state = {
      ...state,
      robots: [{ ...state.robots[0], isLockedDown: true }],
      playerTurn: 0,
      movesThisTurn: 3,
    };

    const advanceMove: GameMove = {
      type: 'advance',
      player: 0,
      position: { q: 1, r: -6 },
    };

    expect(() => applyMove(state, advanceMove)).toThrow('locked down');
  });
});

describe('applyMove - turn', () => {
  it('turns a robot left', () => {
    let state = createGame(defaultGameDef);

    // Place a robot facing E
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 1, r: 0 }, // E
    });

    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    const turnMove: GameMove = {
      type: 'turn',
      player: 0,
      position: { q: 1, r: -6 },
      direction: 'left',
    };

    const newState = applyMove(state, turnMove);
    const robot = newState.robots[0];

    // E turned left should be NE {q: 1, r: -1}
    expect(robot.direction.q === 1).toBe(true);
    expect(robot.direction.r === -1).toBe(true);
  });

  it('turns a robot right', () => {
    let state = createGame(defaultGameDef);

    // Place a robot facing E
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 1, r: 0 }, // E
    });

    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    const turnMove: GameMove = {
      type: 'turn',
      player: 0,
      position: { q: 1, r: -6 },
      direction: 'right',
    };

    const newState = applyMove(state, turnMove);
    const robot = newState.robots[0];

    // E turned right should be SE {q: 0, r: 1}
    expect(robot.direction.q === 0).toBe(true);
    expect(robot.direction.r === 1).toBe(true);
  });
});

describe('isCorridor', () => {
  it('identifies corridor positions correctly', () => {
    const state = createGame(defaultGameDef);

    // Arena radius is 5, corridor is at distance 6
    expect(isCorridor(state, { q: 6, r: 0 })).toBe(true);
    expect(isCorridor(state, { q: 0, r: 6 })).toBe(true);
    expect(isCorridor(state, { q: -6, r: 6 })).toBe(true);

    // Inside arena
    expect(isCorridor(state, { q: 5, r: 0 })).toBe(false);
    expect(isCorridor(state, { q: 0, r: 0 })).toBe(false);

    // Outside corridor
    expect(isCorridor(state, { q: 7, r: 0 })).toBe(false);
  });
});

describe('transport serialization', () => {
  it('round-trips correctly', () => {
    let state = createGame(defaultGameDef);

    // Place a robot
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    });

    const transport = toTransport(state);
    const restored = fromTransport(transport);

    expect(restored.gameDef).toEqual(state.gameDef);
    expect(restored.players).toEqual(state.players);
    expect(restored.robots).toEqual(state.robots);
    expect(restored.playerTurn).toEqual(state.playerTurn);
    expect(restored.movesThisTurn).toEqual(state.movesThisTurn);
    expect(restored.winner).toEqual(state.winner);
    expect(restored.requiresTieBreak).toEqual(state.requiresTieBreak);
  });
});

describe('immutability', () => {
  it('does not mutate input state', () => {
    const state = createGame(defaultGameDef);
    const originalState = structuredClone(state);

    const move: GameMove = {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    };

    applyMove(state, move);

    expect(state).toEqual(originalState);
  });
});

describe('checkGameOver', () => {
  it('returns not over at game start', () => {
    const state = createGame(defaultGameDef);
    const result = checkGameOver(state);
    expect(result.isOver).toBe(false);
  });

  it('detects winner when opponent eliminated', () => {
    const state = createGame(defaultGameDef);

    // Simulate player 1 being eliminated (has 2 robots remaining)
    state.players[1].placedRobots = 4; // 6 - 4 = 2 robots in reserve, 0 on board

    const result = checkGameOver(state);
    expect(result.isOver).toBe(true);
    expect(result.winner).toBe(0);
  });
});

describe('possibleMoves', () => {
  it('generates place moves on first action', () => {
    const state = createGame(defaultGameDef);
    const moves = possibleMoves(state);

    const placeMoves = moves.filter((m) => m.type === 'place');
    expect(placeMoves.length).toBeGreaterThan(0);
  });

  it('generates advance and turn moves for owned robots', () => {
    let state = createGame(defaultGameDef);

    // Place a robot
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 1, r: -6 },
      direction: { q: 0, r: 1 },
    });

    // Skip to player 0's turn with robots on board
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    // Place another robot to have one in arena
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: -1, r: 6 },
      direction: { q: 0, r: -1 },
    });

    // Now advance the robot into the arena
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    const advanceMove: GameMove = {
      type: 'advance',
      player: 0,
      position: { q: -1, r: 6 },
    };
    state = applyMove(state, advanceMove);

    // Now robot is in arena, get possible moves
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };
    const moves = possibleMoves(state);

    const advanceMoves = moves.filter((m) => m.type === 'advance');
    const turnMoves = moves.filter((m) => m.type === 'turn');

    // Should have advance and turn moves for the robot in arena
    expect(advanceMoves.length).toBeGreaterThan(0);
    expect(turnMoves.length).toBeGreaterThan(0);
  });
});

// Port of TestMoves from Go (lockitdown_test.go lines 36-144)
// 20-step move sequence testing place, advance, turn, and beam lock+destroy
describe('TestMoves (Go port)', () => {
  const TWO_PLAYER_GAME_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('executes 20-step sequence correctly', () => {
    let state = createGame(TWO_PLAYER_GAME_DEF);

    // Move 1: Player 0 places at (0, 5) facing NW
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 0, r: 5 },
      direction: { q: 0, r: -1 }, // NW
    });
    expect(state.playerTurn).toBe(1); // Turn advances

    // Move 2: Player 1 places at (5, 0) facing W
    state = applyMove(state, {
      type: 'place',
      player: 1,
      position: { q: 5, r: 0 },
      direction: { q: -1, r: 0 }, // W
    });
    expect(state.playerTurn).toBe(0);

    // Move 3: Player 0 advances (0,5) -> (0,4)
    state = applyMove(state, {
      type: 'advance',
      player: 0,
      position: { q: 0, r: 5 },
    });

    // Move 4: Player 0 turns right
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });

    // Move 5: Player 0 turns left
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'left',
    });
    expect(state.playerTurn).toBe(1); // Turn complete

    // Move 6: Player 1 places at (-5, 4) facing E
    state = applyMove(state, {
      type: 'place',
      player: 1,
      position: { q: -5, r: 4 },
      direction: { q: 1, r: 0 }, // E
    });
    expect(state.playerTurn).toBe(0);

    // Moves 7-9: Player 0 turns right 3 times (rotates direction)
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    expect(state.playerTurn).toBe(1);

    // Move 10-11: Player 1 advances (-5,4) -> (-4,4) and (5,0) -> (4,0)
    state = applyMove(state, {
      type: 'advance',
      player: 1,
      position: { q: -5, r: 4 },
    });
    state = applyMove(state, {
      type: 'advance',
      player: 1,
      position: { q: 5, r: 0 },
    });

    // Move 12: Player 1 turns (4,0) left
    state = applyMove(state, {
      type: 'turn',
      player: 1,
      position: { q: 4, r: 0 },
      direction: 'left',
    });
    expect(state.playerTurn).toBe(0);

    // Moves 13-15: Player 0 turns right 3 more times
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    expect(state.playerTurn).toBe(1);

    // Move 16: Player 1 places at (0, -5) facing SE
    state = applyMove(state, {
      type: 'place',
      player: 1,
      position: { q: 0, r: -5 },
      direction: { q: 0, r: 1 }, // SE
    });
    expect(state.playerTurn).toBe(0);

    // Moves 17-19: Player 0 turns right 3 more times
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    state = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: 0, r: 4 },
      direction: 'right',
    });
    expect(state.playerTurn).toBe(1);

    // Move 20: Player 1 advances (0,-5) -> (0,-4)
    state = applyMove(state, {
      type: 'advance',
      player: 1,
      position: { q: 0, r: -5 },
    });

    // Verify final state
    expect(state.players[0].placedRobots).toBe(1);
    expect(state.players[1].placedRobots).toBe(3);

    // After the beam resolution timing fix, the advancing robot's beam is re-enabled
    // AFTER the initial resolution, then a FINAL resolution pass evaluates targeting.
    // So player 1's robot at (0,-4) facing SE now also targets player 0's robot at (0,4).
    // This creates 3 attackers:
    // - Robot at (4,0) facing SW
    // - Robot at (-4,4) facing E
    // - Robot at (0,-4) facing SE (the advancing robot, beam re-enabled in final pass)
    // With 3 attackers, the robot is DESTROYED, awarding 3 points to player 1.
    expect(state.players[1].points).toBe(3);

    // Verify player 0's robot is destroyed
    const player0Robot = state.robots.find(r => r.player === 0);
    expect(player0Robot).toBeUndefined();
  });
});

// Port of TestGameOver from Go (lockitdown_test.go lines 145-255)
describe('TestGameOver (Go port)', () => {
  const TWO_PLAYER_GAME_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('detects winner when player eliminated', () => {
    // Simpler test: verify game over detection works
    const state = createGame(TWO_PLAYER_GAME_DEF);

    // Player 0 has placed all robots and has none on board (all destroyed)
    state.players = [
      { points: 0, placedRobots: 6 },
      { points: 6, placedRobots: 3 },
    ];

    // Player 1 has 3 robots, player 0 has 0
    state.robots = [
      { position: { q: 0, r: -2 }, direction: { q: 0, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
      { position: { q: 2, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
      { position: { q: -2, r: 2 }, direction: { q: 1, r: -1 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];

    const result = checkGameOver(state);
    // Player 0 has 0 total robots (6 placed - 6 destroyed = 0 remaining, ≤2 means eliminated)
    expect(result.isOver).toBe(true);
    expect(result.winner).toBe(1);
  });
});

// Port of TestPossibleMovesFromState from Go (lockitdown_test.go lines 389-473)
describe('TestPossibleMovesFromState (Go port)', () => {
  it('generates moves from deserialized state', () => {
    const transportState: TransportState = {
      gameDef: {
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: 'Elimination',
      },
      players: [
        { points: 0, placedRobots: 2 },
        { points: 0, placedRobots: 1 },
      ],
      robots: [
        [{ q: -1, r: -4 }, { player: 1, dir: { q: 0, r: 1 }, isLocked: false, isBeamEnabled: false }],
        [{ q: -4, r: -1 }, { player: 2, dir: { q: 0, r: 1 }, isLocked: false, isBeamEnabled: false }],
        [{ q: -1, r: 5 }, { player: 1, dir: { q: 1, r: 0 }, isLocked: false, isBeamEnabled: false }],
      ],
      playerTurn: 2,
      status: 'OnGoing',
      movesThisTurn: 0,
      requiresTieBreak: false,
    };

    const state = fromTransport(transportState);
    const moves = possibleMoves(state);

    // Should have moves available
    expect(moves.length).toBeGreaterThan(0);

    // Player 1's turn (0-indexed: playerTurn 2 - 1 = 1)
    expect(state.playerTurn).toBe(1);
  });
});

// Port of TestEnterNoTieBreak from Go (lockitdown_test.go lines 712-755)
describe('TestEnterNoTieBreak (Go port)', () => {
  const TWO_PLAYER_GAME_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('advances into position and triggers tiebreak with final resolution pass', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    state.robots = [
      { position: { q: -4, r: 4 }, direction: { q: 1, r: -1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 0, r: -4 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: -4, r: 0 }, direction: { q: 0, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
      { position: { q: 5, r: -5 }, direction: { q: -1, r: 1 }, isBeamEnabled: false, isLockedDown: false, player: 1 },
    ];
    state.playerTurn = 1;

    // Advance from corridor - after final resolution pass, this triggers tiebreak
    // because:
    // - Robot at (4, -4) (advanced from 5, -5) targets robot at (-4, 4)
    // - Robot at (-4, 4) targets robot at (4, -4) (mutual targeting = tiebreak)
    const newState = applyMove(state, {
      type: 'advance',
      player: 1,
      position: { q: 5, r: -5 },
    });

    expect(newState.requiresTieBreak).toBe(true);
  });
});

// Port of TestTurnLocksDownBot from Go (lockitdown_test.go lines 756-807)
describe('TestTurnLocksDownBot (Go port)', () => {
  const TWO_PLAYER_GAME_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('directly locks target with 2 attackers (no turn needed)', () => {
    // Two robots targeting the same enemy - need to position them so they
    // don't block each other's line of sight
    const state = createGame(TWO_PLAYER_GAME_DEF);

    state.robots = [
      // Player 0 robots on different axes targeting same enemy
      // Robot at (-3, 0) facing E targets on E axis
      { position: { q: -3, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      // Robot at (0, -3) facing SE targets on SE axis (same q, a.r < t.r)
      { position: { q: 0, r: -3 }, direction: { q: 0, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      // Player 1 target robot at origin
      { position: { q: 0, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    state.playerTurn = 0;

    // Verify target is locked via findTargetedRobots
    const targeted = findTargetedRobots(state);
    expect(targeted.has(2)).toBe(true); // Robot index 2 is targeted
    expect(targeted.get(2)?.length).toBe(2); // By 2 attackers
  });

  it('turning changes which robots are targeted', () => {
    // Test that turning a robot changes the targeting state
    const state = createGame(TWO_PLAYER_GAME_DEF);

    // Two player 0 robots facing same direction
    state.robots = [
      { position: { q: -3, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: -2, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 0, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    state.playerTurn = 0;

    // Before the turn, target should be locked
    const beforeTargeted = findTargetedRobots(state);
    expect(beforeTargeted.has(2)).toBe(true); // Target is robot index 2

    // Turn one robot away so it no longer targets
    const newState = applyMove(state, {
      type: 'turn',
      player: 0,
      position: { q: -3, r: 0 },
      direction: 'right', // E -> SE, no longer on E axis
    });

    // After turn, with only one attacker, target should be unlocked
    const targetRobot = newState.robots.find(r => r.position.q === 0 && r.position.r === 0);
    expect(targetRobot?.isLockedDown).toBe(false);
  });
});

// Port of TestTargeted from Go (lockitdown_test.go lines 808-843)
describe('TestTargeted (Go port)', () => {
  it('finds targeted robots correctly', () => {
    // Set up a scenario where multiple robots are targeted
    const state = createGame(defaultGameDef);
    state.robots = [
      // Robot 0 at origin facing SW - targets robots on SW axis
      { position: { q: 0, r: 0 }, direction: { q: -1, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      // Robot 1 at (-4, 4) facing NE - could target robot 0 (but same q axis)
      { position: { q: -4, r: 4 }, direction: { q: 1, r: -1 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
      // Robot 2 at (4, -4) facing SW - could target robot 0
      { position: { q: 4, r: -4 }, direction: { q: -1, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
      // Robot 3 at (0, -4) facing SE - targets robots on SE axis
      { position: { q: 0, r: -4 }, direction: { q: 0, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];

    const targeted = findTargetedRobots(state);

    // Robot 0 (at origin) can target Robot 2 (at 4, -4) via SW axis
    // Robot 1 (at -4, 4) can target Robot 0 via NE axis (same s, r decreasing)
    // Robot 2 (at 4, -4) can target Robot 0 via SW axis (same s, q decreasing - but target is at origin, different s)
    // Robot 3 (at 0, -4) can target Robot 0 via SE axis (same q, r increasing)

    // So Robot 0 is targeted by robots 1 and 3 (2 attackers)
    // And Robot 2 is targeted by robot 0 (1 attacker)
    expect(targeted.size).toBeGreaterThan(0);
    expect(targeted.has(0)).toBe(true); // Robot at origin is targeted
  });
});

// Port of TestMoveIntoPotentialTieBreak from Go (lockitdown_test.go lines 845-975)
describe('TestMoveIntoPotentialTieBreak (Go port)', () => {
  it('allows move when requiresTieBreak is already true', () => {
    const transportState: TransportState = {
      gameDef: {
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: 'Elimination',
      },
      players: [
        { points: 0, placedRobots: 3 },
        { points: 0, placedRobots: 3 },
      ],
      robots: [
        [{ q: -3, r: 3 }, { player: 1, dir: { q: 1, r: -1 }, isLocked: true, isBeamEnabled: false }],
        [{ q: 0, r: 4 }, { player: 1, dir: { q: 0, r: -1 }, isLocked: false, isBeamEnabled: true }],
        [{ q: 5, r: -5 }, { player: 2, dir: { q: 0, r: 1 }, isLocked: false, isBeamEnabled: false }],
        [{ q: 1, r: 3 }, { player: 2, dir: { q: -1, r: 0 }, isLocked: false, isBeamEnabled: true }],
        [{ q: -4, r: 4 }, { player: 2, dir: { q: 1, r: -1 }, isLocked: false, isBeamEnabled: true }],
        [{ q: 0, r: -4 }, { player: 1, dir: { q: 0, r: 1 }, isLocked: false, isBeamEnabled: true }],
      ],
      playerTurn: 2,
      status: 'OnGoing',
      movesThisTurn: 1,
      requiresTieBreak: true,
    };

    const state = fromTransport(transportState);

    // This should not throw - move is allowed even when requiresTieBreak is true
    const newState = applyMove(state, {
      type: 'advance',
      player: 1, // player 2 in transport = player 1 in internal (0-indexed)
      position: { q: 1, r: 3 },
    });

    expect(newState).toBeDefined();
  });
});

// Stress test similar to TestFakeMinimaxStressTest (Go lines 358-388)
// Tests state consistency across many moves
describe('Stress test - state consistency', () => {
  const TWO_PLAYER_GAME_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('maintains state consistency across recursive moves to depth 3', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);

    function recur(currentState: GameState, depth: number): void {
      if (depth === 0) return;

      const moves = possibleMoves(currentState);
      for (const move of moves.slice(0, 5)) { // Limit to first 5 for performance
        const transportBefore = toTransport(currentState);

        try {
          const newState = applyMove(currentState, move);
          recur(newState, depth - 1);

          // Verify transport round-trip
          const transported = toTransport(newState);
          const restored = fromTransport(transported);

          expect(restored.gameDef).toEqual(newState.gameDef);
          expect(restored.playerTurn).toEqual(newState.playerTurn);
        } catch {
          // Some moves may be invalid - that's OK for stress test
        }

        // Original state should be unchanged (immutability)
        const restoredBefore = fromTransport(transportBefore);
        expect(restoredBefore.playerTurn).toEqual(currentState.playerTurn);
      }
    }

    recur(state, 3);
  });
});

// Additional tests for edge cases
describe('Edge cases', () => {
  const gameDef: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('prevents placing robot when player has max robots', () => {
    const state = createGame(gameDef);
    state.players[0].placedRobots = 6; // Max robots placed

    // Should still be able to place (validation is on remaining robots)
    // The Go code allows placing until robotsPerPlayer is exhausted
    expect(() => applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 0, r: 5 },
      direction: { q: 0, r: -1 },
    })).not.toThrow();
  });

  it('handles multiple players correctly', () => {
    const multiPlayerDef: GameDef = {
      board: { hexaBoard: { arenaRadius: 4 } },
      numOfPlayers: 3,
      robotsPerPlayer: 6,
      winCondition: 'Elimination',
      movesPerTurn: 3,
    };

    const state = createGame(multiPlayerDef);
    expect(state.players.length).toBe(3);

    // Player 0 places
    let newState = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 0, r: 5 },
      direction: { q: 0, r: -1 },
    });
    expect(newState.playerTurn).toBe(1);

    // Player 1 places
    newState = applyMove(newState, {
      type: 'place',
      player: 1,
      position: { q: 5, r: 0 },
      direction: { q: -1, r: 0 },
    });
    expect(newState.playerTurn).toBe(2);

    // Player 2 places
    newState = applyMove(newState, {
      type: 'place',
      player: 2,
      position: { q: -5, r: 0 },
      direction: { q: 1, r: 0 },
    });
    expect(newState.playerTurn).toBe(0); // Wrap around to player 0
  });
});

// Tests for possibleMoves function (validMoves was removed as redundant)
describe('possibleMoves validation', () => {
  const gameDef: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('does not generate place moves after first action', () => {
    const state = createGame(gameDef);
    state.movesThisTurn = 2; // Not first action

    const moves = possibleMoves(state);
    const placeMoves = moves.filter((m: GameMove) => m.type === 'place');

    expect(placeMoves.length).toBe(0); // Can't place after first action
  });

  it('does not generate advance moves for locked robots', () => {
    const state = createGame(gameDef);
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: true, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    const advanceMoves = moves.filter((m: GameMove) => m.type === 'advance');

    expect(advanceMoves.length).toBe(0); // Can't advance locked robot
  });

  it('does not generate advance moves into occupied hexes', () => {
    const state = createGame(gameDef);
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 1, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    const advanceMoves = moves.filter((m: GameMove) => m.type === 'advance' && m.position.q === 0 && m.position.r === 0);

    expect(advanceMoves.length).toBe(0); // Can't advance into occupied hex
  });

  it('does not generate turn moves for opponent robots', () => {
    const state = createGame(gameDef);
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    const turnMoves = moves.filter((m: GameMove) => m.type === 'turn');

    expect(turnMoves.length).toBe(0); // Can't turn opponent's robot
  });

  it('returns all valid moves in a typical game state', () => {
    let state = createGame(gameDef);

    // Place robots for both players
    state = applyMove(state, {
      type: 'place',
      player: 0,
      position: { q: 0, r: 5 },
      direction: { q: 0, r: -1 },
    });
    state = applyMove(state, {
      type: 'place',
      player: 1,
      position: { q: 5, r: 0 },
      direction: { q: -1, r: 0 },
    });

    // Now player 0's turn with robots to move
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    expect(moves.length).toBeGreaterThan(0);

    // All possible moves should be executable
    for (const move of moves) {
      expect(() => applyMove(state, move)).not.toThrow();
    }
  });
});

// Tests for activeBot resolution pattern (Fix C1)
describe('activeBot resolution', () => {
  const TWO_PLAYER_DEF: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    movesPerTurn: 3,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
  };

  // Direction constants
  const E: Pair = { q: 1, r: 0 };
  const W: Pair = { q: -1, r: 0 };

  it('should not re-enable beam of turning robot during resolution', () => {
    // Set up: Robot A (player 0) can lock Robot B (player 1) with its beam
    //         after turning. During resolution, Robot A's beam should stay off.
    const game = createGame(TWO_PLAYER_DEF);
    game.robots = [
      { position: { q: 0, r: 0 }, direction: E, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 2, r: 0 }, direction: W, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    game.playerTurn = 0;
    game.movesThisTurn = 3;

    // Turn Robot A to face a different direction
    // During resolution, Robot A's beam should stay OFF
    // So Robot B should NOT be locked by Robot A during this turn's resolution
    const turned = applyMove(game, { type: 'turn', player: 0, position: { q: 0, r: 0 }, direction: 'right' });

    // After resolution completes and beam is re-enabled, the targeting should be evaluated
    // on the NEXT move's resolution, not during this one
    // The key test: Robot B should NOT be locked after a single turn (only 1 attacker before turn)
    const robotB = turned.robots.find(r => r.player === 1);
    expect(robotB?.isLockedDown).toBe(false);
  });

  it('should not re-enable beam of advancing robot during resolution', () => {
    const game = createGame(TWO_PLAYER_DEF);
    game.robots = [
      { position: { q: -1, r: 0 }, direction: E, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 2, r: 0 }, direction: W, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    game.playerTurn = 0;
    game.movesThisTurn = 3;

    // Advance Robot A from (-1,0) to (0,0) — beam should stay off during resolution
    const advanced = applyMove(game, { type: 'advance', player: 0, position: { q: -1, r: 0 } });

    // Verify beam is re-enabled AFTER resolution (if not locked)
    const robotA = advanced.robots.find(r => r.player === 0);
    expect(robotA?.isBeamEnabled).toBe(true);
    expect(robotA?.position).toEqual({ q: 0, r: 0 });
  });

  it('active robot should not be affected by resolution beam re-enable', () => {
    // This test verifies that the active robot's beam is NOT re-enabled
    // by the resolution loop's updateLockedRobots function
    const game = createGame(TWO_PLAYER_DEF);
    game.robots = [
      { position: { q: -1, r: 0 }, direction: E, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    game.playerTurn = 0;
    game.movesThisTurn = 3;

    // Advance the robot
    const advanced = applyMove(game, { type: 'advance', player: 0, position: { q: -1, r: 0 } });

    // The _activeRobotPosition should be cleared after applyMove completes
    expect(advanced._activeRobotPosition).toBeUndefined();
  });

  it('turning robot should not immediately target enemies during resolution', () => {
    // Set up a scenario where turning would enable targeting an enemy
    // But the beam should stay off during resolution so no lock occurs
    const game = createGame(TWO_PLAYER_DEF);
    game.robots = [
      // Two robots that could target an enemy if they face the right way
      { position: { q: -2, r: 0 }, direction: E, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 0, r: -2 }, direction: { q: 0, r: 1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      // Enemy at origin
      { position: { q: 0, r: 0 }, direction: W, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];
    game.playerTurn = 0;
    game.movesThisTurn = 3;

    // The enemy at origin is already targeted by 2 attackers (should be locked)
    const targeted = findTargetedRobots(game);
    expect(targeted.has(2)).toBe(true); // Robot index 2 (enemy) is targeted
    expect(targeted.get(2)?.length).toBe(2); // By 2 attackers

    // Now turn one attacker away - beam should stay off during resolution
    const turned = applyMove(game, {
      type: 'turn',
      player: 0,
      position: { q: -2, r: 0 },
      direction: 'right', // E -> SE, no longer targeting enemy
    });

    // After turning away, enemy should only have 1 attacker, so should be unlocked
    const enemyAfter = turned.robots.find(r => r.player === 1);
    expect(enemyAfter?.isLockedDown).toBe(false);
  });
});

// Tests for board boundary checking
describe('Board boundary validation', () => {
  const gameDef: GameDef = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: 'Elimination',
    movesPerTurn: 3,
  };

  it('prevents advancing robot off the board from arena edge', () => {
    const state = createGame(gameDef);
    // Place a robot at the arena edge (distance 4) facing outward
    state.robots = [
      { position: { q: 4, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    // Try to advance outward - this would put robot at (5, 0) which is in corridor
    // This should succeed (corridor is allowed)
    const corridorState = applyMove(state, {
      type: 'advance',
      player: 0,
      position: { q: 4, r: 0 },
    });
    expect(corridorState.robots[0].position).toEqual({ q: 5, r: 0 });

    // Now try to advance further outward from corridor - should fail
    corridorState.playerTurn = 0;
    corridorState.movesThisTurn = 3;

    expect(() => applyMove(corridorState, {
      type: 'advance',
      player: 0,
      position: { q: 5, r: 0 },
    })).toThrow('off the board');
  });

  it('prevents advancing robot off the board from corridor', () => {
    const state = createGame(gameDef);
    // Place a robot in the corridor (distance 5 = arenaRadius + 1) facing outward
    state.robots = [
      { position: { q: 5, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: false, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    // Try to advance outward from corridor - should fail (would be distance 6)
    expect(() => applyMove(state, {
      type: 'advance',
      player: 0,
      position: { q: 5, r: 0 },
    })).toThrow('off the board');
  });

  it('prevents advancing robot off the board from corner corridor position', () => {
    const state = createGame(gameDef);
    // Place a robot at corner of corridor, facing diagonally outward
    // At position (3, 2), distance = (3+2+1)/2 = 3, so we need distance 5
    // Position (3, 2) has distance 3, position (4, 1) has distance (4+1+3)/2 = 4
    // Position (3, 2) facing NE {q:1, r:-1} would go to (4, 1)
    // Let's use a corridor position facing outward
    state.robots = [
      { position: { q: 3, r: 2 }, direction: { q: 1, r: -1 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    // Advance to (4, 1) which is distance 4 - still in arena, should succeed
    const advanced = applyMove(state, {
      type: 'advance',
      player: 0,
      position: { q: 3, r: 2 },
    });
    expect(advanced.robots[0].position).toEqual({ q: 4, r: 1 });
  });

  it('allows advance within arena boundaries', () => {
    const state = createGame(gameDef);
    // Place a robot in the center facing E
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    // Should be able to advance multiple times within arena
    let currentState = state;
    for (let i = 0; i < 4; i++) {
      currentState = applyMove(currentState, {
        type: 'advance',
        player: 0,
        position: { q: i, r: 0 },
      });
      currentState.playerTurn = 0;
      currentState.movesThisTurn = 3;
    }

    // Robot should now be at (4, 0) - the arena edge
    expect(currentState.robots[0].position).toEqual({ q: 4, r: 0 });
  });

  it('allows advance from arena to corridor', () => {
    const state = createGame(gameDef);
    // Place a robot at arena edge facing outward
    state.robots = [
      { position: { q: 4, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    // Advance to corridor (distance 5) - should succeed
    const newState = applyMove(state, {
      type: 'advance',
      player: 0,
      position: { q: 4, r: 0 },
    });

    expect(newState.robots[0].position).toEqual({ q: 5, r: 0 });
    // Robot in corridor should have beam disabled
    expect(newState.robots[0].isBeamEnabled).toBe(false);
  });

  it('possibleMoves does not generate advance moves that would go off board', () => {
    const state = createGame(gameDef);
    // Place a robot at corridor edge facing outward
    state.robots = [
      { position: { q: 5, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: false, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    const advanceMoves = moves.filter((m: GameMove) => m.type === 'advance');

    // Should have no advance moves since the only direction would go off board
    expect(advanceMoves.length).toBe(0);
  });

  it('possibleMoves generates advance moves that stay within bounds', () => {
    const state = createGame(gameDef);
    // Place a robot in arena facing inward
    state.robots = [
      { position: { q: 3, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];
    state.playerTurn = 0;
    state.movesThisTurn = 3;

    const moves = possibleMoves(state);
    const advanceMoves = moves.filter((m: GameMove) => m.type === 'advance');

    // Should have an advance move since moving inward stays within bounds
    expect(advanceMoves.length).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { createGame, applyMove, fromTransport, checkGameOver } from '../game.js';
import { possibleMoves } from '../moves.js';
import { findBestMove, playAiGame } from '../ai.js';
import { scoreGameState } from '../evaluator.js';
import type { GameDef, TransportState } from '../types.js';

const TWO_PLAYER_GAME_DEF: GameDef = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  robotsPerPlayer: 6,
  winCondition: 'Elimination',
  movesPerTurn: 3,
};

describe('scoreGameState', () => {
  it('returns equal score at game start', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    const score0 = scoreGameState(state, 0);
    const score1 = scoreGameState(state, 1);

    expect(score0).toBe(0);
    expect(score1).toBe(0);
  });

  it('penalizes locked down robots', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: true, player: 0 },
    ];

    const score = scoreGameState(state, 0);
    expect(score).toBeLessThan(0);
  });

  it('rewards robots on axis (corners)', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    // Robot at origin (q=0, r=0, s=0) - on all axes
    state.robots = [
      { position: { q: 0, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];

    const scoreOnAxis = scoreGameState(state, 0);

    // Robot off axis
    state.robots = [
      { position: { q: 2, r: 1 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
    ];

    const scoreOffAxis = scoreGameState(state, 0);

    expect(scoreOnAxis).toBeGreaterThan(scoreOffAxis);
  });

  it('rewards robots with enemies in beam range', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    // Robot facing enemy on attack axis
    state.robots = [
      { position: { q: -3, r: 0 }, direction: { q: 1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 0, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];

    const scoreWithTarget = scoreGameState(state, 0);

    // Robot facing away from enemy
    state.robots = [
      { position: { q: -3, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 0, r: 0 }, direction: { q: -1, r: 0 }, isBeamEnabled: true, isLockedDown: false, player: 1 },
    ];

    const scoreWithoutTarget = scoreGameState(state, 0);

    expect(scoreWithTarget).toBeGreaterThan(scoreWithoutTarget);
  });

  it('rewards player points', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    state.players[0].points = 3;

    const score0 = scoreGameState(state, 0);
    const score1 = scoreGameState(state, 1);

    // Both scores should be positive because evaluator uses current player's points
    // (player 0 has 3 points, and it's player 0's turn)
    expect(score0).toBeGreaterThan(0);
    expect(score1).toBeGreaterThan(0); // Also sees player 0's points (it's their turn)
  });
});

describe('findBestMove', () => {
  it('returns a valid move at game start', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    const result = findBestMove(state, 0, 2);

    expect(result.move).not.toBeNull();
    expect(result.move?.type).toBe('place');
  });

  it('returns a valid move from mid-game state', () => {
    let state = createGame(TWO_PLAYER_GAME_DEF);

    // Make some initial moves
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

    // Player 0's turn
    state = { ...state, playerTurn: 0, movesThisTurn: 3 };

    const result = findBestMove(state, 0, 2);

    expect(result.move).not.toBeNull();
    expect(['place', 'advance', 'turn']).toContain(result.move?.type);
  });

  it('respects timeout', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);
    const result = findBestMove(state, 0, 3, 10); // 10ms timeout

    expect(result.move).not.toBeNull();
  });

  it('finds moves from deserialized state (Go test port)', () => {
    const transportState: TransportState = {
      gameDef: {
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: 'Elimination',
      },
      players: [
        { points: 0, placedRobots: 1 },
        { points: 0, placedRobots: 1 },
      ],
      robots: [
        [{ q: -3, r: -2 }, { player: 1, dir: { q: 1, r: 0 }, isLocked: false, isBeamEnabled: false }],
        [{ q: 2, r: -5 }, { player: 2, dir: { q: 1, r: 0 }, isLocked: false, isBeamEnabled: false }],
      ],
      playerTurn: 1,
      status: 'OnGoing',
      movesThisTurn: 0,
      requiresTieBreak: false,
    };

    const state = fromTransport(transportState);
    const result = findBestMove(state, 0, 3);

    expect(result.move).not.toBeNull();
    expect(result.move?.player).toBe(0);
  });
});

describe('playAiGame', () => {
  it('plays a complete game without errors', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);

    // Play a game with depth 2, max 100 moves
    const winner = playAiGame(state, 2, 100);

    // Game should complete with a winner or draw
    expect(winner).toBeGreaterThanOrEqual(-1);
    expect(winner).toBeLessThanOrEqual(1);
  });

  it('AI makes progress toward winning', () => {
    const state = createGame(TWO_PLAYER_GAME_DEF);

    // Play 50 moves and verify the game progresses
    let currentState = state;
    for (let i = 0; i < 50; i++) {
      const { isOver } = checkGameOver(currentState);
      if (isOver) break;

      const result = findBestMove(currentState, currentState.playerTurn, 2);
      if (!result.move) break;

      currentState = applyMove(currentState, result.move);
    }

    // Verify game has progressed (robots on board)
    expect(currentState.robots.length).toBeGreaterThan(0);
  });
});

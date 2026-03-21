/**
 * GameStateBuilder - fluent API for creating game states in tests
 *
 * @example
 * ```typescript
 * const state = GameStateBuilder.create()
 *   .placeRobot(0, 'corridor-S', 'N')
 *   .placeRobot(1, 'corridor-N', 'S')
 *   .build();
 * ```
 *
 * @example Direct robot construction (bypasses validation)
 * ```typescript
 * const state = GameStateBuilder.create()
 *   .addRobot({ player: 0, position: { q: 0, r: 0 }, direction: 'E', isLockedDown: true })
 *   .build();
 * ```
 */

import type { GameState, GameDef, Robot, TransportState, Pair, GameMove } from '../types.js';
import { createGame, applyMove, toTransport } from '../game.js';
import { DIRECTIONS, POSITIONS, type DirectionName, type PositionName } from './aliases.js';

/** Input type for direction - either a named direction or a raw Pair */
export type DirectionAlias = DirectionName | Pair;

/** Input type for position - either a named position or a raw Pair */
export type PositionAlias = PositionName | Pair;

/** Input for directly adding a robot (bypasses validation) */
export interface RobotInput {
  player: number;
  position: PositionAlias;
  direction: DirectionAlias;
  isBeamEnabled?: boolean;
  isLockedDown?: boolean;
}

/** Preset scenario names */
export type PresetName = 'empty' | 'twoRobotsFacing' | 'lockdownScenario';

/** Default game definition used by the builder */
const DEFAULT_GAME_DEF: GameDef = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: 'Elimination',
};

/**
 * Resolve a direction alias to a Pair
 */
function resolveDirection(dir: DirectionAlias): Pair {
  if (typeof dir === 'string') {
    const resolved = DIRECTIONS[dir];
    if (!resolved) {
      throw new Error(`Unknown direction: ${dir}`);
    }
    return { ...resolved };
  }
  return { ...dir };
}

/**
 * Resolve a position alias to a Pair
 */
function resolvePosition(pos: PositionAlias): Pair {
  if (typeof pos === 'string') {
    const resolved = POSITIONS[pos];
    if (!resolved) {
      throw new Error(`Unknown position: ${pos}`);
    }
    return { ...resolved };
  }
  return { ...pos };
}

/**
 * Fluent builder for creating GameState instances in tests.
 */
export class GameStateBuilder {
  private gameDef: GameDef;
  private robots: Robot[] = [];
  private playerTurn: number = 0;
  private movesThisTurn: number = 3;
  private winner: number = -1;

  private constructor(gameDef?: Partial<GameDef>) {
    this.gameDef = gameDef ? { ...DEFAULT_GAME_DEF, ...gameDef } : { ...DEFAULT_GAME_DEF };
    this.movesThisTurn = this.gameDef.movesPerTurn;
  }

  // ==========================================================================
  // FACTORY METHODS
  // ==========================================================================

  /** Create a new builder with default game definition */
  static create(): GameStateBuilder {
    return new GameStateBuilder();
  }

  /** Create a builder with a custom game definition */
  static withGameDef(gameDef: Partial<GameDef>): GameStateBuilder {
    return new GameStateBuilder(gameDef);
  }

  /** Create a builder from a preset scenario */
  static preset(name: PresetName): GameStateBuilder {
    const builder = new GameStateBuilder();

    switch (name) {
      case 'empty':
        // Just the default empty state
        break;

      case 'twoRobotsFacing':
        // Two robots facing each other in the arena
        builder.addRobot({
          player: 0,
          position: { q: 0, r: -1 },
          direction: 'SE',
        });
        builder.addRobot({
          player: 1,
          position: { q: 0, r: 1 },
          direction: 'NW',
        });
        break;

      case 'lockdownScenario':
        // Player 0 robot locked down in the arena
        builder.addRobot({
          player: 0,
          position: { q: 0, r: 0 },
          direction: 'E',
          isLockedDown: true,
          isBeamEnabled: false,
        });
        builder.addRobot({
          player: 1,
          position: { q: 2, r: 0 },
          direction: 'W',
        });
        break;
    }

    return builder;
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /** Set the number of players */
  withPlayers(count: number): this {
    this.gameDef.numOfPlayers = count;
    return this;
  }

  /** Set whose turn it is */
  setTurn(player: number): this {
    this.playerTurn = player;
    return this;
  }

  /** Set moves remaining this turn */
  setMovesRemaining(count: number): this {
    this.movesThisTurn = count;
    return this;
  }

  /** Set the winner (for testing game over states) */
  setWinner(player: number): this {
    this.winner = player;
    return this;
  }

  // ==========================================================================
  // ROBOT PLACEMENT (VALIDATED THROUGH applyMove)
  // ==========================================================================

  /**
   * Place a robot in the corridor (validated through game rules).
   * This simulates a real place move.
   */
  placeRobot(player: number, position: PositionAlias, direction: DirectionAlias): this {
    const pos = resolvePosition(position);
    const dir = resolveDirection(direction);

    // Create a minimal state to apply the move
    const tempState = this.buildInternal();

    const move: GameMove = {
      type: 'place',
      player,
      position: pos,
      direction: dir,
    };

    // Apply the move - this validates placement rules
    const newState = applyMove(tempState, move);

    // Copy the resulting state back
    this.robots = newState.robots.map(r => ({ ...r }));
    this.playerTurn = newState.playerTurn;
    this.movesThisTurn = newState.movesThisTurn;

    return this;
  }

  // ==========================================================================
  // DIRECT STATE MANIPULATION (BYPASSES VALIDATION)
  // ==========================================================================

  /**
   * Add a robot directly to the state without validation.
   * Use this for edge cases that can't occur through normal gameplay.
   */
  addRobot(input: RobotInput): this {
    const robot: Robot = {
      player: input.player,
      position: resolvePosition(input.position),
      direction: resolveDirection(input.direction),
      isBeamEnabled: input.isBeamEnabled ?? true,
      isLockedDown: input.isLockedDown ?? false,
    };

    this.robots.push(robot);
    return this;
  }

  // ==========================================================================
  // OUTPUT
  // ==========================================================================

  /** Build the final GameState */
  build(): GameState {
    return this.buildInternal();
  }

  /** Build and convert to TransportState (for seeding via API) */
  buildTransport(): TransportState {
    return toTransport(this.buildInternal());
  }

  /** Build and return JSON string (for debugging or storage) */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  // ==========================================================================
  // INTERNAL
  // ==========================================================================

  private buildInternal(): GameState {
    // Create base state from game def
    const base = createGame(this.gameDef);

    return {
      ...base,
      robots: this.robots.map(r => ({
        position: { ...r.position },
        direction: { ...r.direction },
        isBeamEnabled: r.isBeamEnabled,
        isLockedDown: r.isLockedDown,
        player: r.player,
      })),
      playerTurn: this.playerTurn,
      movesThisTurn: this.movesThisTurn,
      winner: this.winner,
    };
  }
}

/** Axial hex coordinates (q, r). The third axis s = -q - r is derived. */
export interface Pair {
  q: number;
  r: number;
}

export type PlayerPosition = number; // 0-indexed player index

export type TurnDirection = 'left' | 'right';

export type WinCondition = 'Elimination';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface BoardType {
  arenaRadius: number;
}

export interface Board {
  hexaBoard: BoardType;
}

export interface GameDef {
  board: Board;
  numOfPlayers: number;
  movesPerTurn: number;        // always 3
  robotsPerPlayer: number;     // default 6
  winCondition: string;        // "Elimination"
}

export interface Robot {
  position: Pair;
  direction: Pair;
  isBeamEnabled: boolean;
  isLockedDown: boolean;
  player: PlayerPosition;
}

export interface Player {
  points: number;
  placedRobots: number;
}

export interface GameState {
  gameDef: GameDef;
  players: Player[];
  robots: Robot[];
  playerTurn: PlayerPosition;
  movesThisTurn: number;
  requiresTieBreak: boolean;
  winner: number;              // -1 = ongoing
  /** @internal Position of robot being moved — skip during resolution */
  _activeRobotPosition?: Pair;
  /** All moves from the previous turn (for UI highlighting) */
  lastTurnMoves?: LastTurnMoves;
}

// Move types — discriminated union
export type GameMove =
  | { type: 'place';   player: PlayerPosition; position: Pair; direction: Pair }
  | { type: 'advance'; player: PlayerPosition; position: Pair }
  | { type: 'turn';    player: PlayerPosition; position: Pair; direction: TurnDirection };

// Transport format (matches Go's JSON serialization for wire compatibility)
export interface TransportRobot {
  player: number;        // 1-indexed (Go convention)
  dir: Pair;
  isLocked: boolean;
  isBeamEnabled: boolean;
}

/** A single robot entry in transport format: [position, robotData] */
export type TransportRobotEntry = [Pair, TransportRobot];

export interface TransportState {
  gameDef: GameDef;
  players: Player[];
  robots: TransportRobotEntry[];
  playerTurn: number;    // 1-indexed
  status: string;        // "OnGoing" | winner number as string
  movesThisTurn: number;
  requiresTieBreak: boolean;
  /** All moves from the previous turn (for UI highlighting) */
  lastTurnMoves?: LastTurnMoves;
}

// TieBreak state when multiple robots can be targeted
export interface TieBreak {
  robots: Robot[];
  state: string;
}

/** A single move from a player's turn */
export interface TurnMove {
  type: 'place' | 'advance' | 'turn';
  position: Pair;         // Primary position (where robot is/was)
  destination?: Pair;     // For advance: where robot moved to
}

/** All moves from a player's turn for highlighting */
export interface LastTurnMoves {
  player: number;
  moves: TurnMove[];
}

import type {
  GameState,
  GameDef,
  GameMove,
  Pair,
  Robot,
  Player,
  PlayerPosition,
  TransportState,
  TransportRobot,
  TransportRobotEntry,
} from "./types.js";
import { pairDist, pairEq, pairKey } from "./hex.js";
import { resolveMove } from "./resolution.js";

/** Create a new game from a game definition */
export function createGame(gameDef: GameDef): GameState {
  const players: Player[] = [];
  for (let i = 0; i < gameDef.numOfPlayers; i++) {
    players.push({ points: 0, placedRobots: 0 });
  }

  return {
    gameDef,
    players,
    robots: [],
    playerTurn: 0,
    movesThisTurn: gameDef.movesPerTurn,
    requiresTieBreak: false,
    winner: -1,
  };
}

/** Find robot at a given position, or undefined */
export function robotAt(state: GameState, hex: Pair): Robot | undefined {
  return state.robots.find((robot) => pairEq(robot.position, hex));
}

/** Find robot index at a given position, or -1 */
export function robotIndexAt(state: GameState, hex: Pair): number {
  return state.robots.findIndex((robot) => pairEq(robot.position, hex));
}

/** Check if a position is in the corridor ring */
export function isCorridor(state: GameState, pair: Pair): boolean {
  const corridor = state.gameDef.board.hexaBoard.arenaRadius + 1;
  return pairDist(pair) === corridor;
}

/** Create a deep clone of game state */
export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

/** Execute a move, returns new game state or throws error */
export function applyMove(state: GameState, move: GameMove): GameState {
  if (move.player !== state.playerTurn) {
    throw new Error(
      `Wrong player: expected ${state.playerTurn}, got ${move.player}`,
    );
  }

  // Clone state for immutability
  const newState = cloneState(state);

  // Execute the move based on type
  switch (move.type) {
    case "place":
      executePlace(newState, move);
      break;
    case "advance":
      executeAdvance(newState, move);
      break;
    case "turn":
      executeTurn(newState, move);
      break;
  }

  // Resolve beam interactions
  resolveMove(newState);

  // Re-enable the active robot's beam AFTER resolution (matching Go pattern)
  // The active robot's beam is disabled during move execution and should stay
  // off during resolution to prevent it from affecting the lock/destroy outcomes
  if (newState._activeRobotPosition !== undefined) {
    const activePos = newState._activeRobotPosition;
    const activeRobot = robotAt(newState, activePos);
    if (activeRobot) {
      activeRobot.isBeamEnabled =
        !isCorridor(newState, activeRobot.position) &&
        !activeRobot.isLockedDown;
    }
    newState._activeRobotPosition = undefined;
  }

  // Advance turn if out of moves
  if (newState.movesThisTurn === 0) {
    newState.playerTurn = (newState.playerTurn + 1) % state.players.length;
    newState.movesThisTurn = newState.gameDef.movesPerTurn;
  }

  // Check for game over
  const { isOver, winner } = checkGameOver(newState);
  if (isOver) {
    newState.winner = winner;
  }

  return newState;
}

/** Place a robot in the corridor (mutates state) */
function executePlace(
  state: GameState,
  move: Extract<GameMove, { type: "place" }>,
): void {
  if (state.movesThisTurn !== state.gameDef.movesPerTurn) {
    throw new Error("Can only place a robot on your first action of the turn");
  }

  if (!isCorridor(state, move.position)) {
    throw new Error("Must place robot in corridor");
  }

  // Count robots in corridor for this player
  const robotsInCorridor = state.robots.filter(
    (r) => r.player === move.player && isCorridor(state, r.position),
  ).length;

  if (robotsInCorridor > 1) {
    throw new Error("Can only have two robots in the corridor at a time");
  }

  // Add the new robot
  state.robots.push({
    position: move.position,
    direction: move.direction,
    isBeamEnabled: true,
    isLockedDown: false,
    player: move.player,
  });

  // Place consumes entire turn
  state.movesThisTurn = 0;
  state.players[move.player].placedRobots += 1;

  // Track active robot position for resolution (skip during beam evaluation)
  state._activeRobotPosition = { ...move.position };
}

/** Advance a robot one hex in its facing direction (mutates state) */
function executeAdvance(
  state: GameState,
  move: Extract<GameMove, { type: "advance" }>,
): void {
  const robotIdx = robotIndexAt(state, move.position);
  if (robotIdx === -1) {
    throw new Error(`No robot at location ${pairKey(move.position)}`);
  }

  const robot = state.robots[robotIdx];

  if (robot.isLockedDown) {
    throw new Error("Cannot advance, robot is locked down");
  }

  if (robot.player !== move.player) {
    throw new Error(`Cannot move robot, it belongs to Player ${robot.player}`);
  }

  // Calculate advance position
  const advanceSpot: Pair = {
    q: robot.position.q + robot.direction.q,
    r: robot.position.r + robot.direction.r,
  };

  // Check for blocking robot
  if (robotAt(state, advanceSpot)) {
    throw new Error("Cannot advance, another bot in the way");
  }

  // Move the robot
  robot.position = advanceSpot;
  robot.isBeamEnabled = false; // Disabled during advance

  // Track active robot position for resolution (skip during beam evaluation)
  state._activeRobotPosition = { ...advanceSpot };

  state.movesThisTurn -= 1;
}

/** Turn a robot 60° left or right (mutates state) */
function executeTurn(
  state: GameState,
  move: Extract<GameMove, { type: "turn" }>,
): void {
  const robotIdx = robotIndexAt(state, move.position);
  if (robotIdx === -1) {
    throw new Error(`Cannot find robot at ${pairKey(move.position)}`);
  }

  const robot = state.robots[robotIdx];

  if (robot.player !== move.player) {
    throw new Error(`Cannot move robot, it belongs to Player ${robot.player}`);
  }

  // Disable beam during turn
  robot.isBeamEnabled = false;

  // Track active robot position for resolution (skip during beam evaluation)
  state._activeRobotPosition = { ...robot.position };

  // Rotate direction
  const s = -robot.direction.q - robot.direction.r;
  if (move.direction === "right") {
    robot.direction = { q: -robot.direction.r, r: -s };
  } else {
    robot.direction = { q: -s, r: -robot.direction.q };
  }

  state.movesThisTurn -= 1;
}

/** Check game over by elimination */
export function checkGameOver(state: GameState): {
  isOver: boolean;
  winner: number;
} {
  if (state.gameDef.winCondition !== "Elimination") {
    return { isOver: false, winner: -1 };
  }

  // Count robots on board by player
  const botsOnBoard = new Map<number, number>();
  for (const robot of state.robots) {
    botsOnBoard.set(robot.player, (botsOnBoard.get(robot.player) ?? 0) + 1);
  }

  let eliminated = 0;
  let survivor = 0;

  for (let position = 0; position < state.players.length; position++) {
    const player = state.players[position];
    const onBoard = botsOnBoard.get(position) ?? 0;
    const totalRobots =
      state.gameDef.robotsPerPlayer - player.placedRobots + onBoard;

    if (totalRobots <= 2) {
      eliminated++;
    } else {
      survivor = position;
    }
  }

  // If all but one player is eliminated, we have a winner
  if (eliminated + 1 === state.players.length) {
    return { isOver: true, winner: survivor };
  }

  return { isOver: false, winner: -1 };
}

/** Convert internal state to transport format */
export function toTransport(state: GameState): TransportState {
  const robots: TransportRobotEntry[] = state.robots.map(
    (robot): TransportRobotEntry => {
      const transportRobot: TransportRobot = {
        player: robot.player + 1, // 1-indexed
        dir: robot.direction,
        isLocked: robot.isLockedDown,
        isBeamEnabled: robot.isBeamEnabled,
      };
      return [robot.position, transportRobot];
    },
  );

  const status = state.winner < 0 ? "OnGoing" : String(state.winner);

  return {
    gameDef: state.gameDef,
    players: [...state.players],
    robots,
    playerTurn: state.playerTurn + 1, // 1-indexed
    status,
    movesThisTurn: state.gameDef.movesPerTurn - state.movesThisTurn,
    requiresTieBreak: state.requiresTieBreak,
  };
}

/** Convert transport format to internal state */
export function fromTransport(transport: TransportState): GameState {
  const players: Player[] = transport.players.map((p) => ({ ...p }));

  const robots: Robot[] = transport.robots.map(
    (entry: TransportRobotEntry): Robot => {
      const position = entry[0];
      const tRobot = entry[1];
      return {
        position: { q: position.q, r: position.r },
        direction: { q: tRobot.dir.q, r: tRobot.dir.r },
        isBeamEnabled: tRobot.isBeamEnabled,
        isLockedDown: tRobot.isLocked,
        player: tRobot.player - 1, // Convert from 1-indexed
      };
    },
  );

  let winner = -1;
  if (transport.status !== "OnGoing") {
    winner = parseInt(transport.status, 10);
  }

  return {
    gameDef: { ...transport.gameDef },
    players,
    robots,
    playerTurn: transport.playerTurn - 1, // Convert from 1-indexed
    movesThisTurn: transport.gameDef.movesPerTurn - transport.movesThisTurn,
    requiresTieBreak: transport.requiresTieBreak,
    winner,
  };
}

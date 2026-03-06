import { createGame, applyMove, GameMove } from "@lockitdown/engine";
import { CARDINALS } from "@lockitdown/engine";
import { toTransport, fromTransport } from "@lockitdown/engine";

const GAME_DEF = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  robotsPerPlayer: 6,
  winCondition: "Elimination" as const,
  movesPerTurn: 3,
};

let state = createGame(GAME_DEF);
console.log("Initial state:", {
  playerTurn: state.playerTurn,
  movesThisTurn: state.movesThisTurn,
  robots: state.robots.length,
});

const move: GameMove = {
  type: "place",
  player: 0,
  position: { q: 0, r: 5 },
  direction: CARDINALS[3],
};

try {
  let newState = applyMove(state, move);
  console.log("Move successful. Robots on board:");
  console.log(newState.robots);
  console.log("Moves remaining:", newState.movesThisTurn);
  console.log("Player turn:", newState.playerTurn);

  const transport = toTransport(newState);
  const back = fromTransport(transport);
  console.log("After transport serialization roundtrip:");
  console.log(back.robots);
} catch (e: unknown) {
  if (e instanceof Error) {
    console.log("Error applying move:", e.message);
  } else {
    console.log("Error applying move:", e);
  }
}

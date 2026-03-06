import { createGame, applyMove, GameMove } from '@lockitdown/engine';
import { CARDINALS } from '@lockitdown/engine';

const GAME_DEF = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: 'Elimination' as const,
};

let state = createGame(GAME_DEF);
console.log("Moves this turn initially:", state.movesThisTurn);

const move: GameMove = {
  type: 'place',
  player: 0,
  position: { q: 0, r: 5 }, // valid corridor position
  direction: CARDINALS[3], // inward facing
};

try {
  let newState = applyMove(state, move);
  console.log("Move successful. Robots on board:", newState.robots.length);
  console.log("Moves remaining:", newState.movesThisTurn);
} catch (e) {
  console.log("Error:", e.message);
}

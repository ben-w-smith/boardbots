import { createGame, applyMove, GameMove } from "@lockitdown/engine";
import { CARDINALS } from "@lockitdown/engine";
import { findTargetedRobots } from "@lockitdown/engine/dist/resolution.js";

const GAME_DEF = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  robotsPerPlayer: 6,
  winCondition: "Elimination" as const,
  movesPerTurn: 3,
};

// Simulate diagonally opposite robots
let state = createGame(GAME_DEF);

// Player 0 at (-4, 4) facing NE {1, -1}
state.robots.push({
  position: { q: -4, r: 4 },
  direction: { q: 1, r: -1 },
  isBeamEnabled: true,
  isLockedDown: false,
  player: 0,
});

// Player 1 at (0, 0) facing SW {-1, 1}
state.robots.push({
  position: { q: 0, r: 0 },
  direction: { q: -1, r: 1 },
  isBeamEnabled: true,
  isLockedDown: false,
  player: 1,
});

// Player 1 at (4, -4) facing SW {-1, 1}
state.robots.push({
  position: { q: 4, r: -4 },
  direction: { q: -1, r: 1 },
  isBeamEnabled: true,
  isLockedDown: false,
  player: 1,
});

console.log("Robots on board:");
state.robots.forEach((r, idx) =>
  console.log(
    `[${idx}] Player ${r.player} at (${r.position.q},${r.position.r}) facing (${r.direction.q},${r.direction.r})`,
  ),
);

const targeted = findTargetedRobots(state);
console.log("\nTargeted map: ");
for (const [targetIdx, attackers] of targeted.entries()) {
  console.log(`Robot [${targetIdx}] is targeted by: ${attackers.join(", ")}`);
}

// Another check: SW direction targeting on NW/SE axis
state = createGame(GAME_DEF);
state.robots.push({
  position: { q: 0, r: -4 },
  direction: { q: 0, r: 1 }, // SE (down-right)
  isBeamEnabled: true,
  isLockedDown: false,
  player: 0,
});
state.robots.push({
  position: { q: 0, r: 0 },
  direction: { q: 0, r: -1 }, // NW (up-left)
  isBeamEnabled: true,
  isLockedDown: false,
  player: 1,
});

const targeted2 = findTargetedRobots(state);
console.log("\nTargeted map 2 (Vertical Axis): ");
for (const [targetIdx, attackers] of targeted2.entries()) {
  console.log(`Robot [${targetIdx}] is targeted by: ${attackers.join(", ")}`);
}

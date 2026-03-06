import { describe, it, expect } from "vitest";
import { createGame } from "../game.js";
import { findTargetedRobots } from "../resolution.js";

describe("Diagonal Beams", () => {
  const GAME_DEF = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: "Elimination" as const,
    movesPerTurn: 3,
  };

  it("detects SW/NE beam hits", () => {
    const state = createGame(GAME_DEF);

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

    const targeted = findTargetedRobots(state);

    // Robot 0 (at -4, 4) should hit Robot 1 (at 0,0)
    // Robot 1 (at 0, 0) should hit Robot 0
    // Robot 2 (at 4, -4) should not hit anything, or maybe hit Robot 1 if it wasn't the same team

    // Check hit on index 1
    const hitsOnOne = targeted.get(1);
    expect(hitsOnOne).toBeDefined();
    expect(hitsOnOne).toContain(0); // Player 0 is attacking

    // Check hit on index 0
    const hitsOnZero = targeted.get(0);
    expect(hitsOnZero).toBeDefined();
    expect(hitsOnZero).toContain(1); // Player 1 (index 1) is attacking
  });
});

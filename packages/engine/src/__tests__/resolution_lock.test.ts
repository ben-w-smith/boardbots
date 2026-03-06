import { describe, it, expect } from "vitest";
import { createGame } from "../game.js";
import { resolveMove } from "../resolution.js";

describe("Robot Destruction and Locks", () => {
  const GAME_DEF = {
    board: { hexaBoard: { arenaRadius: 4 } },
    numOfPlayers: 2,
    robotsPerPlayer: 6,
    winCondition: "Elimination" as const,
    movesPerTurn: 3,
  };

  it("destroys a robot hit by 3 beams (and awards points)", () => {
    const state = createGame(GAME_DEF);

    // Player 0 at (0, 0) - The Victim
    state.robots.push({
      position: { q: 0, r: 0 },
      direction: { q: 0, r: -1 }, // Irrelevant
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    });

    // Player 1 at (0, 4) facing N {0, -1}
    state.robots.push({
      position: { q: 0, r: 4 },
      direction: { q: 0, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    // Player 1 at (-4, 4) facing NE {1, -1}
    state.robots.push({
      position: { q: -4, r: 4 },
      direction: { q: 1, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    // Player 1 at (4, 0) facing W {-1, 0}
    state.robots.push({
      position: { q: 4, r: 0 },
      direction: { q: -1, r: 0 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    resolveMove(state);

    // Victim should be destroyed
    expect(state.robots.length).toBe(3);
    expect(state.robots.find((r) => r.player === 0)).toBeUndefined();

    // Player 1 gets 3 points
    expect(state.players[1].points).toBe(3);
  });

  it("locks a robot hit by 2 beams", () => {
    const state = createGame(GAME_DEF);

    // Player 0 at (0, 0) - The Victim
    state.robots.push({
      position: { q: 0, r: 0 },
      direction: { q: 0, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    });

    // Player 1 at (0, 4) facing N {0, -1}
    state.robots.push({
      position: { q: 0, r: 4 },
      direction: { q: 0, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    // Player 1 at (-4, 4) facing NE {1, -1}
    state.robots.push({
      position: { q: -4, r: 4 },
      direction: { q: 1, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    resolveMove(state);

    // Victim should be locked
    expect(state.robots.length).toBe(3);
    const victim = state.robots.find((r) => r.player === 0);
    expect(victim).toBeDefined();
    expect(victim?.isLockedDown).toBe(true);
    expect(victim?.isBeamEnabled).toBe(false);
  });
});

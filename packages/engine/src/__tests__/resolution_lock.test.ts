import { describe, it, expect } from "vitest";
import { createGame, applyMove } from "../game.js";
import { resolveMove } from "../resolution.js";
import type { GameMove } from "../types.js";

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

  it("locks enemy immediately when active robot moves into position with stationary ally already targeting", () => {
    // This test reproduces the bug where:
    // - Robot A (stationary) is already targeting Robot C
    // - Robot B (active) turns to also target Robot C
    // - Robot C should be locked IMMEDIATELY after Robot B's turn
    const state = createGame(GAME_DEF);
    state.movesThisTurn = 3; // Player 0 has full turn available

    // Robot A (Player 0) - stationary, already targeting Robot C from the east
    state.robots.push({
      position: { q: 2, r: 0 },  // East of target
      direction: { q: -1, r: 0 }, // Facing W toward target at (0, 0)
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    });

    // Robot B (Player 0) - will turn to target Robot C from the west
    // Starts facing SOUTH, needs to turn LEFT to face EAST
    state.robots.push({
      position: { q: -2, r: 0 },  // West of target, in arena
      direction: { q: 0, r: 1 },  // Facing S (SE in hex terms)
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    });

    // Robot C (Player 1) - the target at center
    state.robots.push({
      position: { q: 0, r: 0 },
      direction: { q: 0, r: -1 },
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    });

    // Robot B turns LEFT to face EAST toward the target
    // From {0, 1} (SE) turning LEFT gives {1, 0} (E)
    const turnMove: GameMove = {
      type: "turn",
      player: 0,
      position: { q: -2, r: 0 },
      direction: "left",
    };

    const newState = applyMove(state, turnMove);

    // Find Robot C in the new state
    const robotC = newState.robots.find((r) => r.player === 1);
    expect(robotC).toBeDefined();
    expect(robotC?.isLockedDown).toBe(true); // Should be locked immediately after turn
  });
});

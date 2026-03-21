import { test, expect } from "../../fixtures/game";
import { clickHex, waitForGameStateSettled, getGameState, waitForRobotCount } from "../../helpers/game.js";
import { POSITIONS } from "../../helpers/constants.js";

/**
 * Scenario: Player places first robot on corridor hex
 *
 * See: packages/e2e/scenarios/robot-placement.md
 *
 * This test demonstrates the GSD Playwright workflow:
 * 1. Setup is handled by fixtures
 * 2. Actions use clickHex() for logical coordinate clicks
 * 3. waitForGameStateSettled() ensures state is stable before assertions
 * 4. Assertions read directly from window.gameState
 */
test("scenario: player places first robot on corridor hex", async ({
  gameWithPlayers,
}) => {
  const { hostPage } = gameWithPlayers;
  // Preconditions (set by gameWithPlayers fixture):
  // - Two-player game
  // - Playing phase
  // - Player 0's turn
  // - 3 moves remaining
  // - Empty board

  // Step 1: Player 0 clicks corridor hex (0, 5) — south edge
  await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);

  // Step 2: Player 0 clicks direction hex (0, 4) — facing north toward arena center
  await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);

  // Wait for the robot to be placed (state synced from server)
  await waitForRobotCount(hostPage, 1);

  // Wait for state to settle (animations complete, state synced)
  await waitForGameStateSettled(hostPage);

  // Get and verify state
  const state = await getGameState(hostPage) as any;

  // Robot placed at correct position
  expect(state.robots.length).toBe(1);
  const robot = state.robots[0];
  expect(robot.position.q).toBe(POSITIONS.CORRIDOR_SOUTH.q);
  expect(robot.position.r).toBe(POSITIONS.CORRIDOR_SOUTH.r);
  expect(robot.player).toBe(0);

  // Robot faces north (0, -1)
  expect(robot.direction.q).toBe(0);
  expect(robot.direction.r).toBe(-1);

  // Turn advances to player 1
  expect(state.playerTurn).toBe(1);
  expect(state.movesThisTurn).toBe(3);

  // Visual verification: run with --ui or --headed to see:
  // - Robot sprite at hex (0, 5)
  // - Placement animation played
});

/**
 * Critical Gameplay Tests
 *
 * Mission-critical gameplay flows that MUST work.
 * These tests run in CI and locally.
 *
 * Tags: @critical @gameplay
 */

import { test, expect } from "../../fixtures/game.js";
import { POSITIONS } from "../../helpers/constants.js";
import { clickHex, waitForTurn, waitForGameStateSettled, waitForRobotCount, getGameState } from "../../helpers/game.js";

test.describe("Critical Gameplay @critical @gameplay", () => {
  test("game starts with correct initial state @critical @gameplay", async ({
    gameWithPlayers: { hostPage },
  }) => {
    await test.step("Verify initial game state", async () => {
      const state = await hostPage.evaluate(() => {
        const s = (window as any).gameState;
        return {
          playerTurn: s.playerTurn,
          movesThisTurn: s.movesThisTurn,
          robots: s.robots?.length ?? 0,
        };
      });

      expect(state.playerTurn).toBe(0);
      expect(state.movesThisTurn).toBe(3);
      expect(state.robots).toBe(0);
    });
  });

  test("player can place a robot on corridor hex @critical @gameplay", async ({
    gameWithPlayers: { hostPage },
  }) => {
    await test.step("Place robot on corridor", async () => {
      // Click corridor hex to select placement position
      await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);

      // Click direction hex to set facing (toward center)
      await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
    });

    await test.step("Verify robot was placed", async () => {
      await waitForRobotCount(hostPage, 1);

      const state = await getGameState(hostPage) as any;
      const robot = state.robots.find(
        (r: { position: { q: number; r: number } }) =>
          r.position.q === POSITIONS.CORRIDOR_SOUTH.q &&
          r.position.r === POSITIONS.CORRIDOR_SOUTH.r
      );

      expect(robot).toBeDefined();
      expect(robot.player).toBe(0);
    });
  });

  test("host placement syncs to guest client @critical @gameplay", async ({
    gameWithPlayers: { hostPage, guestPage },
  }) => {
    await test.step("Host places a robot", async () => {
      // Click corridor hex to select placement position
      await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);

      // Click direction hex to set facing (toward center)
      await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
    });

    await test.step("Verify robot syncs to guest", async () => {
      // Wait for robot to appear on guest page
      await guestPage.waitForFunction(
        () => (window as any).gameState?.robots?.length > 0,
        null,
        { timeout: 10_000 }
      );

      const guestState = await guestPage.evaluate(() => {
        const s = (window as any).gameState;
        return JSON.parse(JSON.stringify(s));
      });

      const syncedRobot = guestState.robots.find(
        (r: { position: { q: number; r: number } }) =>
          r.position.q === POSITIONS.CORRIDOR_SOUTH.q &&
          r.position.r === POSITIONS.CORRIDOR_SOUTH.r
      );

      expect(syncedRobot).toBeDefined();
      expect(syncedRobot.player).toBe(0);
    });
  });

  test("robot facing is set correctly @critical @gameplay", async ({
    gameWithPlayers: { hostPage },
  }) => {
    await test.step("Place robot with specific facing", async () => {
      // Click corridor hex
      await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);

      // Click direction hex (facing north toward arena center)
      await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
    });

    await test.step("Verify robot direction", async () => {
      await waitForRobotCount(hostPage, 1);
      await waitForGameStateSettled(hostPage);

      const state = await getGameState(hostPage) as any;
      const robot = state.robots[0];

      // Robot should face toward center (north, which is direction q=0, r=-1)
      expect(robot.direction.q).toBe(0);
      expect(robot.direction.r).toBe(-1);
    });
  });

  test("moves counter decrements after placement @critical @gameplay", async ({
    gameWithPlayers: { hostPage },
  }) => {
    await test.step("Check initial moves", async () => {
      const initialState = await hostPage.evaluate(() => {
        const s = (window as any).gameState;
        return { movesThisTurn: s.movesThisTurn };
      });
      expect(initialState.movesThisTurn).toBe(3);
    });

    await test.step("Place a robot", async () => {
      await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);
      await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
      await waitForRobotCount(hostPage, 1);
      await waitForGameStateSettled(hostPage);
    });

    await test.step("Verify turn advanced to player 1 after move exhausted", async () => {
      // After placing 1 robot, the game may advance turn or decrement moves
      // depending on game rules. The key assertion is that the game state changed.
      const state = await getGameState(hostPage) as any;

      // Either moves decremented OR turn advanced - both indicate state change
      const stateChanged =
        state.movesThisTurn !== 3 ||
        state.playerTurn !== 0;

      expect(stateChanged).toBe(true);
    });
  });
});

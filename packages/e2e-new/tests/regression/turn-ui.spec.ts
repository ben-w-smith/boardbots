/**
 * Turn UI Regression Tests
 *
 * Tests for visual indicators that make it obvious when it's a player's turn:
 * 1. Active player panel with glowing border/animation
 * 2. Yellow highlighting for opponent's last turn moves
 * 3. lastTurnMoves tracking in game state
 *
 * Tags: @regression @gameplay @visual
 */

import { test, expect } from "../../fixtures/game.js";
import { POSITIONS } from "../../helpers/constants.js";
import { clickHex, waitForTurn, waitForGameStateSettled } from "../../helpers/game.js";

test.describe("Turn UI @regression @gameplay", () => {
  test.describe("Active Player Panel Styling @regression @gameplay", () => {
    test("player 1 panel has active styling when it's their turn @regression @gameplay", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await test.step("Wait for player 0's turn", async () => {
        await waitForTurn(hostPage, 0);
      });

      await test.step("Verify player 1 panel has active styling", async () => {
        const player1Panel = hostPage.locator("[data-testid='player-info-0']");
        await expect(player1Panel).toHaveClass(/active-player/);
        await expect(player1Panel).toHaveClass(/player-1-active/);

        const player2Panel = hostPage.locator("[data-testid='player-info-1']");
        await expect(player2Panel).not.toHaveClass(/active-player/);
        await expect(player2Panel).not.toHaveClass(/player-2-active/);
      });
    });

    test("active styling switches when turn changes @regression @gameplay", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await test.step("Start with player 0's turn", async () => {
        await waitForTurn(hostPage, 0);
      });

      await test.step("Place 3 robots to end turn", async () => {
        // First robot
        await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);
        await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
        await waitForGameStateSettled(hostPage);

        // Second robot
        const corridorNorth = { q: 0, r: -4 };
        const arenaEntryNorth = { q: 0, r: -3 };
        await clickHex(hostPage, corridorNorth.q, corridorNorth.r);
        await clickHex(hostPage, arenaEntryNorth.q, arenaEntryNorth.r);
        await waitForGameStateSettled(hostPage);

        // Third robot
        const corridorNE = { q: 4, r: -4 };
        const arenaEntryNE = { q: 3, r: -3 };
        await clickHex(hostPage, corridorNE.q, corridorNE.r);
        await clickHex(hostPage, arenaEntryNE.q, arenaEntryNE.r);
        await waitForGameStateSettled(hostPage);
      });

      await test.step("Verify turn switches to player 1 with active styling", async () => {
        await waitForTurn(hostPage, 1);

        const player1Panel = hostPage.locator("[data-testid='player-info-0']");
        const player2Panel = hostPage.locator("[data-testid='player-info-1']");

        await expect(player1Panel).not.toHaveClass(/active-player/);
        await expect(player2Panel).toHaveClass(/active-player/);
        await expect(player2Panel).toHaveClass(/player-2-active/);
      });
    });
  });

  test.describe("Last Turn Moves Tracking @regression @gameplay", () => {
    test("lastTurnMoves is undefined at game start @regression @gameplay", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await test.step("Wait for game state to settle", async () => {
        await waitForGameStateSettled(hostPage);
      });

      await test.step("Verify no lastTurnMoves at start", async () => {
        const lastTurnMoves = await hostPage.evaluate(() => {
          const state = (window as any).gameState;
          return state?.lastTurnMoves;
        });

        expect(lastTurnMoves).toBeUndefined();
      });
    });

    test("lastTurnMoves tracks player's placement move @regression @gameplay @multiplayer", async ({
      gameWithPlayers: { hostPage, guestPage },
    }) => {
      await test.step("Host places 3 robots to end turn", async () => {
        await waitForTurn(hostPage, 0);

        // First robot
        await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);
        await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
        await waitForGameStateSettled(hostPage);

        // Second robot
        const corridorNorth = { q: 0, r: -4 };
        const arenaEntryNorth = { q: 0, r: -3 };
        await clickHex(hostPage, corridorNorth.q, corridorNorth.r);
        await clickHex(hostPage, arenaEntryNorth.q, arenaEntryNorth.r);
        await waitForGameStateSettled(hostPage);

        // Third robot
        const corridorNE = { q: 4, r: -4 };
        const arenaEntryNE = { q: 3, r: -3 };
        await clickHex(hostPage, corridorNE.q, corridorNE.r);
        await clickHex(hostPage, arenaEntryNE.q, arenaEntryNE.r);
        await waitForGameStateSettled(hostPage);
      });

      await test.step("Verify guest sees lastTurnMoves", async () => {
        await waitForTurn(guestPage, 1);

        const lastTurnMoves = await guestPage.evaluate(() => {
          const state = (window as any).gameState;
          return state?.lastTurnMoves ? JSON.parse(JSON.stringify(state.lastTurnMoves)) : null;
        });

        expect(lastTurnMoves).not.toBeNull();
        expect(lastTurnMoves.player).toBe(0);
        expect(lastTurnMoves.moves).toBeDefined();
        expect(Array.isArray(lastTurnMoves.moves)).toBe(true);
        expect(lastTurnMoves.moves.length).toBeGreaterThan(0);

        const firstMove = lastTurnMoves.moves[0];
        expect(firstMove.type).toBe("place");
        expect(firstMove.position).toBeDefined();
      });
    });
  });

  test.describe("Last Move Highlight Rendering @regression @gameplay @visual", () => {
    test("highlights contain lastMove type after opponent's turn @regression @gameplay @visual", async ({
      gameWithPlayers: { hostPage, guestPage },
    }) => {
      await test.step("Host places 3 robots to end turn", async () => {
        await waitForTurn(hostPage, 0);

        await clickHex(hostPage, POSITIONS.CORRIDOR_SOUTH.q, POSITIONS.CORRIDOR_SOUTH.r);
        await clickHex(hostPage, POSITIONS.ARENA_ENTRY_SOUTH.q, POSITIONS.ARENA_ENTRY_SOUTH.r);
        await waitForGameStateSettled(hostPage);

        const corridorNorth = { q: 0, r: -4 };
        const arenaEntryNorth = { q: 0, r: -3 };
        await clickHex(hostPage, corridorNorth.q, corridorNorth.r);
        await clickHex(hostPage, arenaEntryNorth.q, arenaEntryNorth.r);
        await waitForGameStateSettled(hostPage);

        const corridorNE = { q: 4, r: -4 };
        const arenaEntryNE = { q: 3, r: -3 };
        await clickHex(hostPage, corridorNE.q, corridorNE.r);
        await clickHex(hostPage, arenaEntryNE.q, arenaEntryNE.r);
        await waitForGameStateSettled(hostPage);
      });

      await test.step("Verify guest has lastMove highlights", async () => {
        await waitForTurn(guestPage, 1);
        await guestPage.waitForTimeout(300);

        const highlights = await guestPage.evaluate(() => {
          return (window as any).getHighlights?.() || [];
        });

        const lastMoveHighlights = highlights.filter((h: any) => h.type === "lastMove");
        expect(lastMoveHighlights.length).toBeGreaterThan(0);
      });
    });

    test("no lastMove highlights on your own turn @regression @gameplay @visual", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await test.step("Wait for player 0's turn", async () => {
        await waitForTurn(hostPage, 0);
      });

      await test.step("Verify no lastMove highlights on own turn", async () => {
        const highlights = await hostPage.evaluate(() => {
          return (window as any).getHighlights?.() || [];
        });

        const lastMoveHighlights = highlights.filter((h: any) => h.type === "lastMove");
        expect(lastMoveHighlights.length).toBe(0);
      });
    });
  });
});

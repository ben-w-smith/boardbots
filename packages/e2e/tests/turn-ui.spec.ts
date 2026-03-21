import { test, expect } from "../fixtures/game";
import { POSITIONS } from "../helpers/constants";
import { clickHex, waitForTurn, waitForGameStateSettled } from "../helpers/game";

/**
 * Turn UI Regression Tests
 *
 * Tests for visual indicators that make it obvious when it's a player's turn:
 * 1. Active player panel with glowing border/animation
 * 2. Yellow highlighting for opponent's last turn moves
 * 3. lastTurnMoves tracking in game state
 */

test.describe("Turn UI @regression", () => {
  test.describe("Active Player Panel Styling", () => {
    test("player 1 panel has active styling when it's their turn", async ({
      gameWithPlayers: { hostPage },
    }) => {
      // Game starts with player 0 (host is player 1 in UI)
      await waitForTurn(hostPage, 0);

      // Check that player 1's panel has the active class
      const player1Panel = hostPage.locator("[data-testid='player-info-0']");
      await expect(player1Panel).toHaveClass(/active-player/);
      await expect(player1Panel).toHaveClass(/player-1-active/);

      // Player 2's panel should NOT be active
      const player2Panel = hostPage.locator("[data-testid='player-info-1']");
      await expect(player2Panel).not.toHaveClass(/active-player/);
      await expect(player2Panel).not.toHaveClass(/player-2-active/);
    });

    test("active styling switches when turn changes", async ({
      gameWithPlayers: { hostPage },
    }) => {
      // Start with player 0's turn
      await waitForTurn(hostPage, 0);

      // Place 3 robots to end turn (3 moves per turn)
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

      // Wait for turn to switch to player 1
      await waitForTurn(hostPage, 1);

      // Now player 2's panel should be active
      const player1Panel = hostPage.locator("[data-testid='player-info-0']");
      const player2Panel = hostPage.locator("[data-testid='player-info-1']");

      await expect(player1Panel).not.toHaveClass(/active-player/);
      await expect(player2Panel).toHaveClass(/active-player/);
      await expect(player2Panel).toHaveClass(/player-2-active/);
    });
  });

  test.describe("Last Turn Moves Tracking", () => {
    test("lastTurnMoves is undefined at game start", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await waitForGameStateSettled(hostPage);

      const lastTurnMoves = await hostPage.evaluate(() => {
        const state = (window as any).gameState;
        return state?.lastTurnMoves;
      });

      // At game start, no moves have been made yet
      expect(lastTurnMoves).toBeUndefined();
    });

    test("lastTurnMoves tracks player's placement move", async ({
      gameWithPlayers: { hostPage, guestPage },
    }) => {
      await waitForTurn(hostPage, 0);

      // Host (player 0) places 3 robots to end turn
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

      // Wait for turn to switch
      await waitForTurn(guestPage, 1);

      // Guest should see lastTurnMoves with player 0's moves
      const lastTurnMoves = await guestPage.evaluate(() => {
        const state = (window as any).gameState;
        return state?.lastTurnMoves ? JSON.parse(JSON.stringify(state.lastTurnMoves)) : null;
      });

      expect(lastTurnMoves).not.toBeNull();
      expect(lastTurnMoves.player).toBe(0);
      expect(lastTurnMoves.moves).toBeDefined();
      expect(Array.isArray(lastTurnMoves.moves)).toBe(true);
      expect(lastTurnMoves.moves.length).toBeGreaterThan(0);

      // First move should be a placement with position
      const firstMove = lastTurnMoves.moves[0];
      expect(firstMove.type).toBe("place");
      expect(firstMove.position).toBeDefined();
    });
  });

  test.describe("Last Move Highlight Rendering", () => {
    test("highlights contain lastMove type after opponent's turn", async ({
      gameWithPlayers: { hostPage, guestPage },
    }) => {
      // Host (player 0) places 3 robots to end turn
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

      // Wait for guest's turn
      await waitForTurn(guestPage, 1);

      // Additional wait to ensure state is fully synced
      await guestPage.waitForTimeout(300);

      // Check that guest has lastMove type highlights
      const highlights = await guestPage.evaluate(() => {
        return (window as any).getHighlights?.() || [];
      });

      const lastMoveHighlights = highlights.filter((h: any) => h.type === "lastMove");
      expect(lastMoveHighlights.length).toBeGreaterThan(0);
    });

    test("no lastMove highlights on your own turn", async ({
      gameWithPlayers: { hostPage },
    }) => {
      await waitForTurn(hostPage, 0);

      // On player 0's turn, there should be no lastMove highlights
      const highlights = await hostPage.evaluate(() => {
        return (window as any).getHighlights?.() || [];
      });

      const lastMoveHighlights = highlights.filter((h: any) => h.type === "lastMove");
      expect(lastMoveHighlights.length).toBe(0);
    });
  });
});

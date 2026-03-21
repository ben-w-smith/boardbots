import type { Browser, Page } from "@playwright/test";
import type { TransportState } from "@lockitdown/engine";
import { GameStateBuilder } from "@lockitdown/engine";
import { createGame, joinGame, startGame, waitForGameView } from "./lobby.js";

/**
 * Helper to set up a two-player game that's ready to play.
 * Returns the pages and contexts for both host and guest.
 */
export async function setupGame(browser: Browser) {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  try {
    const code = await createGame(hostPage, "Player1");
    await joinGame(guestPage, code, "Player2");
    await waitForGameView(hostPage);
    await startGame(hostPage);

    // Wait for playing phase on both sides
    await hostPage.waitForFunction(
      () => (window as any).gameState?.gameDef != null,
      null,
      { timeout: 15_000 },
    );
    await guestPage.waitForFunction(
      () => (window as any).gameState?.gameDef != null,
      null,
      { timeout: 15_000 },
    );

    // Also wait for the game canvas to be visible
    await hostPage.locator("#gameCanvas").waitFor({ state: "visible", timeout: 5_000 });
    await guestPage.locator("#gameCanvas").waitFor({ state: "visible", timeout: 5_000 });

    return { hostCtx, guestCtx, hostPage, guestPage };
  } catch (error) {
    // Basic cleanup if setup fails
    try {
      await hostCtx.close();
      await guestCtx.close();
    } catch {
      // Ignore cleanup errors if browser already closed
    }
    throw error;
  }
}

/**
 * Wait for gameStateSettled event - fires when animations complete
 * and the game state is stable for assertions.
 */
export async function waitForGameStateSettled(
  page: Page,
  timeout = 10_000,
): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if there's a pending settled dispatch or if animations are running
      const animating = (window as any).animator?.isAnimating?.() ?? false;
      return !animating;
    },
    null,
    { timeout },
  );
}

/**
 * Wait for a specific player's turn.
 */
export async function waitForTurn(
  page: Page,
  playerIndex: number,
  timeout = 10_000,
): Promise<void> {
  await page.waitForFunction(
    (idx) => (window as any).gameState?.playerTurn === idx,
    playerIndex,
    { timeout },
  );
  // Also wait for state to settle
  await waitForGameStateSettled(page, timeout);
}

/**
 * Get the current game state from the page.
 * Returns null if state not available.
 */
export async function getGameState(page: Page): Promise<unknown> {
  return page.evaluate(() => (window as any).gameState);
}

/**
 * Click on a hex at the given coordinates.
 * Uses the renderer's hexToPixel conversion for accurate positioning.
 */
export async function clickHex(
  page: Page,
  q: number,
  r: number,
): Promise<void> {
  const { x, y } = await page.evaluate(
    ({ q, r }) => {
      const renderer = (window as any).renderer;
      if (!renderer) throw new Error("Renderer not available");
      return renderer.getPixelFromHex(q, r);
    },
    { q, r },
  );

  await page.locator("#gameCanvas").click({ position: { x, y } });
}

/**
 * Get pixel coordinates for a hex (useful for visual assertions).
 */
export async function getHexPixel(
  page: Page,
  q: number,
  r: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ q, r }) => {
      const renderer = (window as any).renderer;
      if (!renderer) throw new Error("Renderer not available");
      return renderer.getPixelFromHex(q, r);
    },
    { q, r },
  );
}

// ============================================================================
// STATE SEEDING UTILITIES
// ============================================================================

/**
 * Seed a game state via the dev API endpoint.
 * Requires the server to be running with dev routes enabled.
 */
export async function seedGameState(
  page: Page,
  gameCode: string,
  state: TransportState,
): Promise<void> {
  await page.request.post(`/api/dev/seed-state`, {
    data: { gameCode, state }
  });
}

/**
 * Create a game, join two players, start playing, and seed state.
 * High-level convenience for integration tests.
 */
export async function setupSeededGame(
  browser: Browser,
  transportState: TransportState
): Promise<{ hostPage: Page; guestPage: Page; gameCode: string }> {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  try {
    const code = await createGame(hostPage, "Player1");
    await joinGame(guestPage, code, "Player2");
    await waitForGameView(hostPage);
    await startGame(hostPage);

    // Wait for playing phase
    await waitForGameStateSettled(hostPage);
    await waitForGameStateSettled(guestPage);

    // Seed the state
    await seedGameState(hostPage, code, transportState);
    await waitForGameStateSettled(hostPage);
    await waitForGameStateSettled(guestPage);

    return { hostPage, guestPage, gameCode: code };
  } catch (error) {
    try {
      await hostCtx.close();
      await guestCtx.close();
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

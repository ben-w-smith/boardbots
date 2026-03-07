import type { Browser } from "@playwright/test";
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
      { timeout: 10_000 },
    );
    await guestPage.waitForFunction(
      () => (window as any).gameState?.gameDef != null,
      null,
      { timeout: 10_000 },
    );

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

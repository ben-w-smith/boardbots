import type { Page } from "@playwright/test";
import { generateTestUsername, registerUser } from "./auth.js";

/**
 * Create a new game as host. Returns the 6-character game code.
 * After calling this, the page will be on the "Waiting for opponent" screen.
 *
 * This function handles the full flow: register -> dashboard -> create game
 */
export async function createGame(
  page: Page,
  playerName = "TestHost",
): Promise<string> {
  // Register a new user (this lands us on the dashboard)
  const username = `${playerName}_${generateTestUsername()}`;
  await registerUser(page, username, "TestPass123");

  // Wait for dashboard to be ready
  await page.locator(".dashboard-container").waitFor({ state: "visible" });

  // Click the "New Game" button on the dashboard
  await page.locator("#dashboard-btn-create").click();

  // Wait for the game code to appear on the lobby's waiting screen
  // Note: There are two .game-code elements - one in the game UI (hidden placeholder)
  // and one in the lobby container (visible with actual code). Select the lobby one.
  const codeEl = page.locator(".lobby-container .game-code");
  await codeEl.waitFor({ state: "visible", timeout: 10_000 });
  const code = await codeEl.textContent();
  if (!code || code === "------") {
    throw new Error("Failed to get game code");
  }
  return code.trim();
}

/**
 * Join an existing game as guest.
 * Uses the dashboard join form to enter the game code.
 *
 * Current UI flow: input is always visible, just fill it and click Join.
 */
export async function joinGame(
  page: Page,
  gameCode: string,
  playerName = "TestGuest",
): Promise<void> {
  // Register a new user (this lands us on the dashboard)
  const username = `${playerName}_${generateTestUsername()}`;
  await registerUser(page, username, "TestPass123");

  // Wait for dashboard to be ready
  await page.locator(".dashboard-container").waitFor({ state: "visible" });

  // The join input is always visible in the current UI
  // Fill in the game code
  await page.locator("#dashboard-join-code").fill(gameCode);

  // Click the Join button to submit
  await page.locator("#dashboard-btn-join").click();

  // Wait for the game UI to appear
  await page.locator(".top-panel").waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Start the game (host only). Requires both players to be connected.
 * The #btn-start button is in the game UI's waiting controls.
 */
export async function startGame(page: Page): Promise<void> {
  const startBtn = page.locator("#btn-start");
  await startBtn.waitFor({ state: "visible", timeout: 10_000 });
  // Wait for button to be enabled (needs 2 players)
  await startBtn.waitFor({ state: "attached" });
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("#btn-start") as HTMLButtonElement;
      return btn && !btn.disabled;
    },
    null,
    { timeout: 10_000 },
  );
  await startBtn.click();
}

/**
 * Wait for the page to transition from lobby to game view.
 * Detected by the game canvas becoming visible and the lobby being hidden.
 */
export async function waitForGameView(page: Page): Promise<void> {
  // The top-panel becomes visible when gameUI.show() is called
  await page
    .locator(".top-panel")
    .waitFor({ state: "visible", timeout: 15_000 });
}

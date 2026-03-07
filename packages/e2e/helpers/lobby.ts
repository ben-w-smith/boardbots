import type { Page } from "@playwright/test";

/**
 * Create a new game as host. Returns the 6-character game code.
 * After calling this, the page will be on the "Waiting for opponent" screen.
 */
export async function createGame(
  page: Page,
  playerName = "TestHost",
): Promise<string> {
  await page.goto("/");
  await page.locator("#player-name").fill(playerName);
  await page.locator("#btn-create").click();

  // Wait for the game code to appear on the waiting screen
  const codeEl = page.locator(".game-code");
  await codeEl.waitFor({ state: "visible", timeout: 10_000 });
  const code = await codeEl.textContent();
  if (!code || code === "------") {
    throw new Error("Failed to get game code");
  }
  return code.trim();
}

/**
 * Join an existing game as guest.
 * Navigates to /?game=CODE which auto-connects with a generated name,
 * OR uses the join form if a specific name is needed.
 */
export async function joinGame(
  page: Page,
  gameCode: string,
  playerName = "TestGuest",
): Promise<void> {
  // Navigate directly with game code — main.ts will auto-generate a name
  // But we want a specific name, so use the lobby join flow
  await page.goto("/");
  await page.locator("#player-name").fill(playerName);
  await page.locator("#btn-join").click();

  // Now on the join screen
  await page.locator("#game-code").fill(gameCode);
  await page.locator("#btn-join-now").click();
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

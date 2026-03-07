import { test, expect } from "../fixtures/game";
import { createGame, joinGame, waitForGameView } from "../helpers/lobby";

test.describe("Lobby", () => {
  test("can create a new game and see game code", async ({ page }) => {
    const code = await createGame(page, "Alice");
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    // URL should have the game code
    expect(page.url()).toContain(`game=${code}`);
  });

  test("can join an existing game via code", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // Host creates
    const code = await createGame(hostPage, "Host");

    // Guest joins
    await joinGame(guestPage, code, "Guest");

    // Both should transition to game view (waiting phase with Start button visible)
    await waitForGameView(hostPage);
    await waitForGameView(guestPage);

    await hostContext.close();
    await guestContext.close();
  });
});

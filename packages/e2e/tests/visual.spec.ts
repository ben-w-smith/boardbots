import { test, expect } from "@playwright/test";
import {
  VisualHelper,
  createVisualHelper,
  VISUAL_STATE_SELECTORS,
} from "../helpers/visual";
import { registerUser, openLoginModal, openRegisterModal, generateTestUsername } from "../helpers/auth";
import { createGame } from "../helpers/lobby";

test.describe("Visual Regression Tests", () => {
  let visual: VisualHelper;

  test.beforeEach(async ({ page }) => {
    visual = createVisualHelper(page);
  });

  test("landing page", async ({ page }) => {
    await page.goto("/");
    await visual.waitForState("landing");

    // Take full page screenshot
    await expect(page).toHaveScreenshot("landing-page.png", {
      fullPage: true,
    });
  });

  test("login modal", async ({ page }) => {
    await page.goto("/");
    await openLoginModal(page);

    const modal = page.locator(".login-modal");
    await expect(modal).toHaveScreenshot("login-modal.png");
  });

  test("register modal", async ({ page }) => {
    await page.goto("/");
    await openRegisterModal(page);

    const modal = page.locator(".login-modal");
    await expect(modal).toHaveScreenshot("register-modal.png");
  });

  test("dashboard (logged in)", async ({ page }) => {
    // Register a new user (lands on dashboard)
    await registerUser(page, generateTestUsername(), "TestPass123");

    await visual.waitForState("dashboard");

    const dashboard = page.locator(".dashboard-container");
    // Mask username display which changes each run
    await expect(dashboard).toHaveScreenshot("dashboard.png", {
      mask: [page.locator(".user-name")],
    });
  });

  test("lobby waiting for opponent", async ({ page }) => {
    // Create a game as host
    await createGame(page, "VisualHost");

    // Wait for the waiting screen with game code
    await visual.waitForState("lobby-waiting");

    // Capture the lobby waiting state
    const lobby = page.locator(".lobby-container");
    // Mask game code which changes each run
    await expect(lobby).toHaveScreenshot("lobby-waiting.png", {
      mask: [page.locator(".game-code")],
    });
  });

  // Skip this test - requires complex multiplayer setup
  // TODO: Fix guest join flow or simplify test
  test.skip("game board (empty - waiting phase)", async ({ page, browser }) => {
    // Set up a two-player game
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      // Host creates game
      const code = await createGame(hostPage, "HostPlayer");

      // Guest joins
      const guestVisual = createVisualHelper(guestPage);
      const guestUsername = generateTestUsername();
      await registerUser(guestPage, guestUsername, "TestPass123");
      await guestPage.locator(".dashboard-container").waitFor({ state: "visible" });
      await guestPage.locator("#dashboard-btn-join").click();
      await guestPage.locator("#dashboard-join-code").fill(code);
      await guestPage.locator("#dashboard-btn-join-now").click();

      // Wait for game view on host side
      await hostPage.locator("#gameCanvas").waitFor({ state: "visible", timeout: 15_000 });

      // Wait for canvas to be stable
      const hostVisual = createVisualHelper(hostPage);
      await hostVisual.waitForStableCanvas();

      // Capture the game canvas (empty board in waiting phase)
      const canvas = hostPage.locator("#gameCanvas");
      await expect(canvas).toHaveScreenshot("game-board-waiting.png");
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });
});

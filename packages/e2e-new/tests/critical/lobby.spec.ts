/**
 * Critical Lobby Tests
 *
 * Mission-critical lobby flows that MUST work.
 * These tests run in CI and locally.
 *
 * Tags: @critical @lobby @multiplayer
 */

import { test, expect } from "@playwright/test";
import { createGame, joinGame, startGame, waitForGameView } from "../../helpers/lobby.js";

test.describe("Critical Lobby @critical @lobby", () => {
  test("host can create a game @critical @lobby", async ({ page }) => {
    await test.step("Create game and get code", async () => {
      const code = await createGame(page);

      // Verify code is 6 characters
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    await test.step("Verify waiting screen appears", async () => {
      // Should show waiting message
      await expect(page.locator(".lobby-container")).toContainText("Waiting");
    });
  });

  test("guest can join a game @critical @lobby @multiplayer", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      let gameCode: string;

      await test.step("Host creates game", async () => {
        gameCode = await createGame(hostPage);
        expect(gameCode).toBeDefined();
      });

      await test.step("Guest joins game", async () => {
        await joinGame(guestPage, gameCode);

        // Guest should see game UI
        await expect(guestPage.locator(".top-panel")).toBeVisible({
          timeout: 10_000,
        });
      });

      await test.step("Host sees guest joined", async () => {
        // Host should now be able to start the game
        const startBtn = hostPage.locator("#btn-start");
        await startBtn.waitFor({ state: "visible", timeout: 5_000 });
      });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test("host can start game with two players @critical @lobby @multiplayer", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      let gameCode: string;

      await test.step("Create and join game", async () => {
        gameCode = await createGame(hostPage);
        await joinGame(guestPage, gameCode);
      });

      await test.step("Start the game", async () => {
        await startGame(hostPage);
      });

      await test.step("Both players see game view", async () => {
        await waitForGameView(hostPage);
        await waitForGameView(guestPage);

        // Both should see game canvas
        await expect(hostPage.locator("#gameCanvas")).toBeVisible();
        await expect(guestPage.locator("#gameCanvas")).toBeVisible();
      });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });
});

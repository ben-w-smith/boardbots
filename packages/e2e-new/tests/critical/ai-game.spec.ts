/**
 * Critical AI Game Tests
 *
 * Mission-critical AI game flows that MUST work.
 * These tests run in CI and locally.
 *
 * Tags: @critical @ai
 */

import { test, expect } from "@playwright/test";
import { registerUser, generateTestUsername } from "../../helpers/auth.js";

const TEST_PASSWORD = "TestPass123";

test.describe("Critical AI Games @critical @ai", () => {
  test.beforeEach(async ({ page }) => {
    const username = generateTestUsername();
    await registerUser(page, username, TEST_PASSWORD);
  });

  test("can create and start an AI game @critical @ai", async ({ page }) => {
    await test.step("Start AI game", async () => {
      await page.locator("#dashboard-btn-vs-ai").click();
    });

    await test.step("Verify game view appears", async () => {
      await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".player-info").first()).toBeVisible();
    });
  });

  test("AI opponent is indicated in UI @critical @ai", async ({ page }) => {
    await test.step("Start AI game", async () => {
      await page.locator("#dashboard-btn-vs-ai").click();
      await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Verify AI indicator visible", async () => {
      const aiIndicator = page.locator(".player-info").filter({ hasText: "AI" });
      await expect(aiIndicator).toBeVisible();
    });
  });

  test("can place a robot in AI game @critical @ai", async ({ page }) => {
    await test.step("Start AI game", async () => {
      await page.locator("#dashboard-btn-vs-ai").click();
      await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Wait for game state", async () => {
      await page.waitForFunction(
        () => (window as any).gameState != null,
        null,
        { timeout: 10_000 },
      );
    });

    await test.step("Place robot on corridor hex (0, 5)", async () => {
      const coords = await page.evaluate(
        () => (window as any).renderer.getPixelFromHex(0, 5),
      );

      await page
        .locator("#gameCanvas")
        .click({ position: { x: coords.x, y: coords.y }, force: true });

      const dirCoords = await page.evaluate(
        () => (window as any).renderer.getPixelFromHex(0, 4),
      );

      await page
        .locator("#gameCanvas")
        .click({ position: { x: dirCoords.x, y: dirCoords.y }, force: true });
    });

    await test.step("Verify robot was placed", async () => {
      await page.waitForFunction(
        () => (window as any).gameState?.robots?.length > 0,
        null,
        { timeout: 5_000 },
      );

      const robots = await page.evaluate(() =>
        JSON.parse(JSON.stringify((window as any).gameState.robots)),
      );

      expect(robots.length).toBeGreaterThan(0);
    });
  });

  test("can create AI game with different difficulties @critical @ai", async ({ page }) => {
    await test.step("Select Easy difficulty if available", async () => {
      const easyBtn = page.locator(".difficulty-btn[data-depth='2']");
      if (await easyBtn.isVisible()) {
        await easyBtn.click();
      }
    });

    await test.step("Create and verify AI game", async () => {
      await page.locator("#dashboard-btn-vs-ai").click();
      await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });
    });
  });
});

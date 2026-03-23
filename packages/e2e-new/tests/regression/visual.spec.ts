/**
 * Visual Regression Tests
 *
 * Screenshot-based visual regression tests for UI consistency.
 * These tests run less frequently and catch visual regressions.
 *
 * Tags: @regression @visual
 */

import { test, expect } from "@playwright/test";
import {
  VisualHelper,
  createVisualHelper,
  VISUAL_STATE_SELECTORS,
} from "../../helpers/visual.js";
import { registerUser, openLoginModal, openRegisterModal, generateTestUsername } from "../../helpers/auth.js";
import { createGame } from "../../helpers/lobby.js";

test.describe("Visual Regression @regression @visual", () => {
  let visual: VisualHelper;

  test.beforeEach(async ({ page }) => {
    visual = createVisualHelper(page);
  });

  test("landing page visual regression @regression @visual", async ({ page }) => {
    await test.step("Load landing page", async () => {
      await page.goto("/");
      await visual.waitForState("landing");
    });

    await test.step("Capture screenshot", async () => {
      await expect(page).toHaveScreenshot("landing-page.png", {
        fullPage: true,
      });
    });
  });

  test("login modal visual regression @regression @visual", async ({ page }) => {
    await test.step("Open login modal", async () => {
      await page.goto("/");
      await openLoginModal(page);
    });

    await test.step("Capture screenshot", async () => {
      const modal = page.locator(".login-modal");
      await expect(modal).toHaveScreenshot("login-modal.png");
    });
  });

  test("register modal visual regression @regression @visual", async ({ page }) => {
    await test.step("Open register modal", async () => {
      await page.goto("/");
      await openRegisterModal(page);
    });

    await test.step("Capture screenshot", async () => {
      const modal = page.locator(".login-modal");
      await expect(modal).toHaveScreenshot("register-modal.png");
    });
  });

  test("dashboard visual regression @regression @visual", async ({ page }) => {
    await test.step("Register and land on dashboard", async () => {
      await registerUser(page, generateTestUsername(), "TestPass123");
      await visual.waitForState("dashboard");
    });

    await test.step("Capture screenshot with masked username", async () => {
      const dashboard = page.locator(".dashboard-container");
      await expect(dashboard).toHaveScreenshot("dashboard.png", {
        mask: [page.locator(".user-name")],
      });
    });
  });

  test("lobby waiting visual regression @regression @visual", async ({ page }) => {
    await test.step("Create game as host", async () => {
      await createGame(page);
    });

    await test.step("Wait for waiting screen", async () => {
      await visual.waitForState("lobby-waiting");
    });

    await test.step("Capture screenshot with masked game code", async () => {
      const lobby = page.locator(".lobby-container");
      await expect(lobby).toHaveScreenshot("lobby-waiting.png", {
        mask: [page.locator(".game-code")],
      });
    });
  });
});

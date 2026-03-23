/**
 * Smoke Tests - Navigation
 *
 * Basic navigation tests to verify routes work.
 * These are fast sanity checks that run in CI and locally.
 *
 * Tags: @smoke
 */

import { test, expect } from "@playwright/test";
import { registerUser } from "../../helpers/auth.js";
import { generateTestUsername } from "../../helpers/auth.js";

test.describe("Smoke - Navigation @smoke", () => {
  test("can navigate to dashboard after login @smoke @auth", async ({ page }) => {
    const username = generateTestUsername();

    await test.step("Register user", async () => {
      await registerUser(page, username, "TestPass123");
    });

    await test.step("Verify dashboard is visible", async () => {
      await expect(page.locator(".dashboard-container")).toBeVisible();
    });
  });

  test("can return to landing page after logout @smoke @auth", async ({ page }) => {
    const username = generateTestUsername();

    await test.step("Register and logout", async () => {
      await registerUser(page, username, "TestPass123");
      await page.locator("#dashboard-btn-logout").click();
    });

    await test.step("Verify landing page is visible", async () => {
      await expect(page.locator(".lobby-container")).toBeVisible();
    });
  });
});

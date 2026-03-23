/**
 * Smoke Tests - Pages Load
 *
 * Basic tests to verify all pages render without crashing.
 * These are fast sanity checks that run in CI and locally.
 *
 * Tags: @smoke
 */

import { test, expect } from "@playwright/test";

test.describe("Smoke - Pages Load @smoke", () => {
  test("landing page loads @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".lobby-container")).toBeVisible();
  });

  test("login modal opens @smoke @auth", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-login").click();
    await expect(page.locator(".login-modal")).toBeVisible();
  });

  test("register modal opens @smoke @auth", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btn-register").click();
    await expect(page.locator(".login-modal")).toBeVisible();
    await expect(page.locator("#auth-confirm")).toBeVisible();
  });
});

/**
 * Critical Auth Tests
 *
 * Mission-critical authentication flows that MUST work.
 * These tests run in CI and locally.
 *
 * Tags: @critical @auth
 */

import { test, expect } from "@playwright/test";
import { generateTestUsername, registerUser, loginUser, logoutUser } from "../../helpers/auth.js";

const TEST_PASSWORD = "TestPass123";

test.describe("Critical Auth @critical @auth", () => {
  test("user can register @critical @auth", async ({ page }) => {
    await test.step("Open register modal", async () => {
      await page.goto("/");
      await page.locator("#btn-register").click();
      await expect(page.locator(".login-modal")).toBeVisible();
    });

    await test.step("Fill registration form", async () => {
      const username = generateTestUsername();
      await page.locator("#auth-username").fill(username);
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#auth-confirm").fill(TEST_PASSWORD);
    });

    await test.step("Submit and verify dashboard", async () => {
      await page.locator("#submit-btn").click();
      await expect(page.locator(".dashboard-container")).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("user can login after registration @critical @auth", async ({ page }) => {
    const username = generateTestUsername();

    await test.step("Register new user", async () => {
      await registerUser(page, username, TEST_PASSWORD);
      await expect(page.locator(".dashboard-container")).toBeVisible();
    });

    await test.step("Logout", async () => {
      await logoutUser(page);
      await expect(page.locator(".lobby-container")).toBeVisible();
    });

    await test.step("Login with same credentials", async () => {
      await loginUser(page, username, TEST_PASSWORD);
      await expect(page.locator(".dashboard-container")).toBeVisible();
    });
  });

  test("user can logout @critical @auth", async ({ page }) => {
    const username = generateTestUsername();

    await test.step("Register and verify dashboard", async () => {
      await registerUser(page, username, TEST_PASSWORD);
      await expect(page.locator(".dashboard-container")).toBeVisible();
    });

    await test.step("Logout and verify landing page", async () => {
      await logoutUser(page);
      await expect(page.locator(".lobby-container")).toBeVisible();
    });
  });
});

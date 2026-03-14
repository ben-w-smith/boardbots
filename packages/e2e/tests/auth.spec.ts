import { test, expect } from "@playwright/test";

const TEST_PASSWORD = "TestPass123";

/**
 * Generate a unique username for testing
 */
function generateTestUsername(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `test_${timestamp}_${random}`;
}

test.describe("Authentication", () => {
  test.describe("Login Modal", () => {
    test("can open login modal from landing page", async ({ page }) => {
      await page.goto("/");

      // Click Log In button
      await page.locator("#btn-login").click();

      // Modal should be visible
      const modal = page.locator(".login-modal");
      await expect(modal).toBeVisible();

      // Should show Sign In heading
      await expect(modal.locator("h2")).toContainText("Sign In");
    });

    test("can close login modal with Cancel button", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-login").click();
      await expect(page.locator(".login-modal")).toBeVisible();

      // Click Cancel
      await page.locator("#cancel-btn").click();

      // Modal should be hidden
      await expect(page.locator(".login-modal")).toBeHidden();
    });

    test("can close login modal with X button", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-login").click();
      await expect(page.locator(".login-modal")).toBeVisible();

      // Click X
      await page.locator("#modal-close").click();

      // Modal should be hidden
      await expect(page.locator(".login-modal")).toBeHidden();
    });

    test("clicking outside modal does not close it", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-login").click();
      await expect(page.locator(".login-modal")).toBeVisible();

      // Click on the overlay (outside the modal content)
      const overlay = page.locator(".login-modal-overlay");
      await overlay.click({ position: { x: 10, y: 10 } });

      // Modal should still be visible
      await expect(page.locator(".login-modal")).toBeVisible();
    });

    test("can switch from login to register mode", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-login").click();

      // Should show Sign In
      const modal = page.locator(".login-modal");
      await expect(modal.locator("h2")).toContainText("Sign In");

      // Click Sign Up link
      await page.locator("#switch-mode").click();

      // Should now show Create Account
      await expect(modal.locator("h2")).toContainText("Create Account");
    });
  });

  test.describe("Register Modal", () => {
    test("can open register modal from landing page", async ({ page }) => {
      await page.goto("/");

      // Click Create Account button
      await page.locator("#btn-register").click();

      // Modal should be visible
      const modal = page.locator(".login-modal");
      await expect(modal).toBeVisible();

      // Should show Create Account heading
      await expect(modal.locator("h2")).toContainText("Create Account");
    });

    test("register modal shows confirm password field", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-register").click();

      // Confirm password field should be visible
      await expect(page.locator("#auth-confirm")).toBeVisible();
    });
  });

  test.describe("Registration Flow", () => {
    test("can register a new user", async ({ page }) => {
      const username = generateTestUsername();

      await page.goto("/");
      await page.locator("#btn-register").click();

      // Fill form
      await page.locator("#auth-username").fill(username);
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#auth-confirm").fill(TEST_PASSWORD);

      // Submit
      await page.locator("#submit-btn").click();

      // Should navigate to dashboard
      await expect(page.locator(".dashboard-container")).toBeVisible({
        timeout: 10_000,
      });

      // Username should be displayed
      await expect(page.locator(".user-name")).toContainText(username);
    });

    test("shows error for password mismatch", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-register").click();

      await page.locator("#auth-username").fill(generateTestUsername());
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#auth-confirm").fill("DifferentPassword123");

      await page.locator("#submit-btn").click();

      // Should show error
      const error = page.locator(".login-error");
      await expect(error).toBeVisible();
      expect(await error.textContent()).toContain("do not match");
    });
  });

  test.describe("Login Flow", () => {
    test("can login after registration", async ({ page }) => {
      const username = generateTestUsername();

      // Register first
      await page.goto("/");
      await page.locator("#btn-register").click();
      await page.locator("#auth-username").fill(username);
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#auth-confirm").fill(TEST_PASSWORD);
      await page.locator("#submit-btn").click();
      await expect(page.locator(".dashboard-container")).toBeVisible({
        timeout: 10_000,
      });

      // Logout
      await page.locator("#dashboard-btn-logout").click();
      await expect(page.locator(".lobby-container")).toBeVisible({ timeout: 5_000 });

      // Login again
      await page.locator("#btn-login").click();
      await page.locator("#auth-username").fill(username);
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#submit-btn").click();

      // Should be on dashboard
      await expect(page.locator(".dashboard-container")).toBeVisible({
        timeout: 10_000,
      });
    });

    test("shows error for invalid credentials", async ({ page }) => {
      await page.goto("/");
      await page.locator("#btn-login").click();

      await page.locator("#auth-username").fill("nonexistent_user");
      await page.locator("#auth-password").fill("WrongPassword123");

      await page.locator("#submit-btn").click();

      // Should show error
      const error = page.locator(".login-error");
      await expect(error).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe("Logout", () => {
    test("can logout from dashboard", async ({ page }) => {
      const username = generateTestUsername();

      // Register
      await page.goto("/");
      await page.locator("#btn-register").click();
      await page.locator("#auth-username").fill(username);
      await page.locator("#auth-password").fill(TEST_PASSWORD);
      await page.locator("#auth-confirm").fill(TEST_PASSWORD);
      await page.locator("#submit-btn").click();
      await expect(page.locator(".dashboard-container")).toBeVisible({
        timeout: 10_000,
      });

      // Logout
      await page.locator("#dashboard-btn-logout").click();

      // Should be back on landing page
      await expect(page.locator(".lobby-container")).toBeVisible({ timeout: 5_000 });
    });
  });
});

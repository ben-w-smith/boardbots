import type { Page } from "@playwright/test";

/**
 * Generate a unique username for testing
 */
export function generateTestUsername(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `test_${timestamp}_${random}`;
}

/**
 * Open the login modal by clicking the Log In button on the landing page
 */
export async function openLoginModal(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#btn-login").click();
  await page.locator(".login-modal").waitFor({ state: "visible" });
}

/**
 * Open the register modal by clicking the Create Account button on the landing page
 */
export async function openRegisterModal(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#btn-register").click();
  await page.locator(".login-modal").waitFor({ state: "visible" });
}

/**
 * Register a new user with the given credentials.
 * Returns the username used (useful for generated usernames).
 */
export async function registerUser(
  page: Page,
  username: string,
  password: string,
): Promise<string> {
  await openRegisterModal(page);

  await page.locator("#auth-username").fill(username);
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-confirm").fill(password);

  await page.locator("#submit-btn").click();

  // Wait for either the modal to close (success) or an error to appear
  await Promise.race([
    page.locator(".login-modal").waitFor({ state: "hidden", timeout: 15_000 }),
    page.locator("#auth-error").waitFor({ state: "visible", timeout: 15_000 }).then(async () => {
      const error = await page.locator("#auth-error").textContent();
      throw new Error(`Registration failed: ${error}`);
    }),
  ]);

  // Wait for dashboard to appear (indicates successful registration)
  await page.locator(".dashboard-container").waitFor({ state: "visible", timeout: 15_000 });

  return username;
}

/**
 * Login with existing credentials.
 */
export async function loginUser(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await openLoginModal(page);

  await page.locator("#auth-username").fill(username);
  await page.locator("#auth-password").fill(password);

  await page.locator("#submit-btn").click();

  // Wait for dashboard to appear
  await page.locator(".dashboard-container").waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Logout the current user from the dashboard.
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.locator("#dashboard-btn-logout").click();
  // Wait for lobby to reappear
  await page.locator(".lobby-container").waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Check if user is on the dashboard (logged in).
 */
export async function isOnDashboard(page: Page): Promise<boolean> {
  const dashboard = page.locator(".dashboard-container");
  return await dashboard.isVisible();
}

/**
 * Check if login modal is visible.
 */
export async function isLoginModalVisible(page: Page): Promise<boolean> {
  const modal = page.locator(".login-modal");
  return await modal.isVisible();
}

/**
 * Close the login/register modal by clicking the X button.
 */
export async function closeModal(page: Page): Promise<void> {
  await page.locator("#modal-close").click();
  await page.locator(".login-modal").waitFor({ state: "hidden" });
}

/**
 * Cancel the modal by clicking the Cancel button.
 */
export async function cancelModal(page: Page): Promise<void> {
  await page.locator("#cancel-btn").click();
  await page.locator(".login-modal").waitFor({ state: "hidden" });
}

/**
 * Get the error message displayed in the modal, if any.
 */
export async function getModalError(page: Page): Promise<string | null> {
  const errorEl = page.locator("#auth-error");
  if (await errorEl.isVisible()) {
    return await errorEl.textContent();
  }
  return null;
}

/**
 * Switch from login to register mode (or vice versa) using the switch link.
 */
export async function switchModalMode(page: Page): Promise<void> {
  const switchBtn = page.locator("#switch-mode");
  await switchBtn.click();
}

/**
 * Create an AI game from the dashboard.
 * Assumes user is already logged in.
 */
export async function createAIGame(page: Page, difficulty: "easy" | "medium" | "hard" = "medium"): Promise<void> {
  // Set difficulty if needed
  const depthMap = { easy: "2", medium: "3", hard: "4" };
  const depth = depthMap[difficulty];

  const diffBtn = page.locator(`.difficulty-btn[data-depth="${depth}"]`);
  if (await diffBtn.isVisible()) {
    await diffBtn.click();
  }

  await page.locator("#dashboard-btn-vs-ai").click();

  // Wait for game view to appear
  await page.locator(".top-panel").waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Wait for the game to start (playing phase).
 */
export async function waitForGameStart(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const state = (window as any).gameState;
      return state && state.robots != null;
    },
    null,
    { timeout: 15_000 },
  );
}

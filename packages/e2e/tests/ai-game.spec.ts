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

/**
 * Register and login a test user
 */
async function registerTestUser(page: import("@playwright/test").Page): Promise<string> {
  const username = generateTestUsername();

  await page.goto("/");
  await page.locator("#btn-register").click();

  await page.locator("#auth-username").fill(username);
  await page.locator("#auth-password").fill(TEST_PASSWORD);
  await page.locator("#auth-confirm").fill(TEST_PASSWORD);

  await page.locator("#submit-btn").click();
  await expect(page.locator(".dashboard-container")).toBeVisible({ timeout: 10_000 });

  return username;
}

test.describe("AI Games", () => {
  test.beforeEach(async ({ page }) => {
    await registerTestUser(page);
  });

  test("can create and start an AI game", async ({ page }) => {
    // Click Play vs AI
    await page.locator("#dashboard-btn-vs-ai").click();

    // Wait for game view to appear (top panel is visible)
    await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });

    // Should see player info panels (both human and AI)
    await expect(page.locator(".player-info").first()).toBeVisible();
  });

  test("AI opponent is indicated in UI", async ({ page }) => {
    await page.locator("#dashboard-btn-vs-ai").click();
    await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });

    // Should show AI indicator
    const aiIndicator = page.locator(".player-info").filter({ hasText: "AI" });
    await expect(aiIndicator).toBeVisible();
  });

  test("can place a robot on corridor hex", async ({ page }) => {
    await page.locator("#dashboard-btn-vs-ai").click();
    await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });

    // Wait for game state to be available
    await page.waitForFunction(
      () => (window as any).gameState != null,
      null,
      { timeout: 10_000 },
    );

    // Get pixel coordinates for corridor hex (0, 5) - south edge
    const coords = await page.evaluate(
      () => (window as any).renderer.getPixelFromHex(0, 5),
    );

    // Click on corridor hex
    await page
      .locator("#gameCanvas")
      .click({ position: { x: coords.x, y: coords.y }, force: true });

    // Click the hex in the direction we want to face (0, 4)
    const dirCoords = await page.evaluate(
      () => (window as any).renderer.getPixelFromHex(0, 4),
    );

    await page
      .locator("#gameCanvas")
      .click({ position: { x: dirCoords.x, y: dirCoords.y }, force: true });

    // Wait for robot to appear
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

  test("can create AI game with different difficulties", async ({ page }) => {
    // Select Easy difficulty
    const easyBtn = page.locator(".difficulty-btn[data-depth='2']");
    if (await easyBtn.isVisible()) {
      await easyBtn.click();
    }

    // Create game
    await page.locator("#dashboard-btn-vs-ai").click();
    await expect(page.locator(".top-panel")).toBeVisible({ timeout: 15_000 });
  });
});

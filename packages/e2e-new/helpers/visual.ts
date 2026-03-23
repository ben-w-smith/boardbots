import type { Page } from "@playwright/test";

/**
 * Visual testing helper utilities for screenshot-based visual regression.
 */
export class VisualHelper {
  constructor(private page: Page) {}

  /**
   * Wait for the canvas animator to be idle (no active animations).
   * This ensures screenshots are consistent.
   */
  async waitForStableCanvas(): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const animator = (window as any).animator;
        if (!animator || !animator.isAnimating()) {
          return true;
        }
        return false;
      },
      null,
      { timeout: 10_000 },
    );
    // Wait an extra frame for stability
    await this.page.waitForTimeout(100);
  }

  /**
   * Capture a full page screenshot.
   * @param name - Screenshot name (will be prefixed with visual state)
   */
  async capturePage(name: string): Promise<Buffer> {
    await this.waitForStableCanvas();
    return await this.page.screenshot({ fullPage: true });
  }

  /**
   * Capture only the game canvas element.
   * @param name - Screenshot name
   */
  async captureCanvas(name: string): Promise<Buffer> {
    await this.waitForStableCanvas();
    const canvas = this.page.locator("#gameCanvas");
    return await canvas.screenshot();
  }

  /**
   * Capture a specific UI component by selector.
   * @param selector - CSS selector for the component
   * @param name - Screenshot name
   */
  async captureComponent(selector: string, name: string): Promise<Buffer> {
    await this.waitForStableCanvas();
    const component = this.page.locator(selector);
    return await component.screenshot();
  }

  /**
   * Wait for a specific UI state to be visible before capturing.
   */
  async waitForState(state: VisualState): Promise<void> {
    const selector = VISUAL_STATE_SELECTORS[state];
    if (!selector) {
      throw new Error(`Unknown visual state: ${state}`);
    }
    await this.page.locator(selector).waitFor({ state: "visible", timeout: 15_000 });
  }
}

/**
 * Key UI states that can be captured for visual regression.
 */
export type VisualState =
  | "landing"
  | "login-modal"
  | "register-modal"
  | "dashboard"
  | "lobby-waiting"
  | "game-board";

/**
 * CSS selectors for each visual state.
 */
export const VISUAL_STATE_SELECTORS: Record<VisualState, string> = {
  landing: ".landing-container",
  "login-modal": ".login-modal",
  "register-modal": ".login-modal", // Same modal, different mode
  dashboard: ".dashboard-container",
  "lobby-waiting": ".lobby-container .game-code",
  "game-board": "#gameCanvas",
};

/**
 * Create a visual helper for a page.
 */
export function createVisualHelper(page: Page): VisualHelper {
  return new VisualHelper(page);
}

/**
 * Wait for the game canvas to be fully rendered and stable.
 */
export async function waitForCanvasReady(page: Page): Promise<void> {
  await page.locator("#gameCanvas").waitFor({ state: "visible" });
  // Wait for renderer to be available
  await page.waitForFunction(
    () => (window as any).renderer != null,
    null,
    { timeout: 10_000 },
  );
}

/**
 * Take a screenshot of the game canvas.
 */
export async function screenshotCanvas(page: Page, name: string): Promise<void> {
  const canvas = page.locator("#gameCanvas");
  await canvas.screenshot({ path: `test-results/${name}.png` });
}

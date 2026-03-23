import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./global-setup.ts",
  testDir: "./tests",
  fullyParallel: false, // Tests share server state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"], // Shows test names in console - primary for AI review
    ["html", { open: "never" }], // HTML report for detailed debugging
  ],
  timeout: 30_000,

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 960 },
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project - resets database before tests
    {
      name: "setup",
      testMatch: /setup\.spec\.ts/,
    },

    // Critical tests - mission-critical flows
    // Run: pnpm test:critical
    {
      name: "critical",
      testDir: "./tests/critical",
      use: { browserName: "chromium" },
      dependencies: ["setup"],
      retries: 2, // More retries for critical tests
    },

    // Smoke tests - basic functionality
    // Run: pnpm test:smoke
    {
      name: "smoke",
      testDir: "./tests/smoke",
      use: { browserName: "chromium" },
      dependencies: ["setup"],
    },

    // Regression tests - comprehensive coverage
    // Run: pnpm test:regression
    // Note: Run locally only, not in CI
    {
      name: "regression",
      testDir: "./tests/regression",
      use: { browserName: "chromium" },
      dependencies: ["setup"],
      retries: 0,
    },

    // Visual regression tests
    {
      name: "visual-regression",
      testDir: "./tests/visual",
      use: { browserName: "chromium" },
      dependencies: ["setup"],
    },

    // Scenarios - feature-specific tests (can be tagged as needed)
    {
      name: "scenarios",
      testDir: "./tests/scenarios",
      use: { browserName: "chromium" },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "npm run dev:test --workspace=packages/server",
      url: "http://127.0.0.1:3000/api/health",
      cwd: "../../",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev --workspace=packages/client",
      url: "http://localhost:5173",
      cwd: "../../",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

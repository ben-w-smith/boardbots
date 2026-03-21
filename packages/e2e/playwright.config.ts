import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Tests share server state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
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
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "visual-regression",
      use: { browserName: "chromium" },
      testMatch: /visual\.spec\.ts$/,
    },
  ],

  webServer: [
    {
      command: "npm run dev --workspace=packages/server",
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

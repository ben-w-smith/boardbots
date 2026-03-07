import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Tests share server state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  timeout: 30_000,

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 960 },
  },

  projects: [{ name: "chromium", use: { browserName: "chromium" } }],

  webServer: [
    {
      command: "npm run dev --workspace=packages/server -- --ip 127.0.0.1",
      url: "http://127.0.0.1:8787/api/health",
      cwd: "../../",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev --workspace=packages/client",
      url: "http://127.0.0.1:5173",
      cwd: "../../",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});

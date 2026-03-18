import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Tests share server state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 960 },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
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

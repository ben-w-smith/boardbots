import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30_000,

  use: {
    baseURL: "http://138.197.0.105",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 960 },
  },

  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],

  // No webServer - testing against production
});

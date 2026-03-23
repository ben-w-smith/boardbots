/**
 * Setup Project - Database Reset
 *
 * This project runs before all other test projects to reset
 * the database to a clean state.
 *
 * Tag: N/A (setup tests don't use tags)
 */

import { test as setup } from "@playwright/test";

setup("reset database", async ({ request }) => {
  const response = await request.post("/api/dev/reset-db");

  if (!response.ok()) {
    console.warn(`Database reset returned status ${response.status()}`);
  }
});

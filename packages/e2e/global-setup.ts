import { request } from '@playwright/test';

async function globalSetup() {
  // Reset the database before running tests
  // Only runs if server is available (reuseExistingServer mode)
  try {
    const context = await request.newContext();
    const response = await context.post('http://127.0.0.1:3000/api/dev/reset-db');
    if (response.ok()) {
      console.log('Database reset successfully before tests');
    } else {
      console.log('Database reset returned:', response.status());
    }
    await context.dispose();
  } catch (error) {
    // Server might not be running yet, which is fine
    // It will be started by Playwright's webServer
    console.log('Database reset skipped (server not available)');
  }
}

export default globalSetup;

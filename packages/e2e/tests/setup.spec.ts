import { test as setup } from '@playwright/test';

// This test runs before other visual-regression tests
// It resets the database to ensure clean state after chromium tests
setup('reset database for visual tests', async ({ request }) => {
  const response = await request.post('/api/dev/reset-db');
  if (response.ok()) {
    console.log('Database reset for visual-regression tests');
  }
});

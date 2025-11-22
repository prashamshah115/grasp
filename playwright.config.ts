import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Load .env.test file
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright E2E Testing Configuration
 * 
 * Base URL: http://localhost:3000 (development server)
 * Timeouts: 30s per test, 60s for navigation
 * Screenshots/Videos: On failure only
 * Retries: 1 for flaky tests
 */

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // No retries locally for speed
  workers: process.env.CI ? 1 : 4, // More workers for faster parallel execution
  globalSetup: require.resolve('./tests/global-setup.ts'),
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5000, // Reduced from 10000
    navigationTimeout: 30000, // Reduced from 60000
  },

  projects: [
    // Only Chromium for fast local testing
    // Uncomment others for full browser coverage
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});


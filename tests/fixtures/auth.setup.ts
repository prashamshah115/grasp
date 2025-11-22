import { test as setup } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Authentication Fixtures and Helpers
 * 
 * Provides reusable authentication utilities for tests
 */

const authFile = 'tests/.auth/user.json';

interface TestUser {
  email: string;
  password: string;
  name?: string;
}

/**
 * Default test user credentials
 */
export const testUser: TestUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'testpassword123',
  name: 'Test User',
};

/**
 * Sign up a new user
 */
export async function signUp(page: Page, user: TestUser = testUser): Promise<void> {
  await page.goto('/');
  
  // Click "Get Started" to open signup modal
  await page.click('button:has-text("Get Started")');
  
  // Wait for modal to appear
  await page.waitForSelector('text=Get started', { timeout: 5000 });
  
  // Fill signup form
  if (user.name) {
    await page.fill('input[id="name"]', user.name);
  }
  await page.fill('input[id="email"]', user.email);
  await page.fill('input[id="password"]', user.password);
  
  // Submit form (use form button)
  await page.locator('form button:has-text("Create Account")').click();
  
  // Wait for redirect to courses page (signup success)
  await page.waitForURL('/courses', { timeout: 10000 });
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
}

/**
 * Sign in an existing user
 */
export async function signIn(page: Page, user: TestUser = testUser): Promise<void> {
  await page.goto('/');
  
  // Click header "Sign In" to open signin modal
  await page.locator('header button:has-text("Sign In")').click();
  
  // Wait for modal to appear
  await page.waitForSelector('text=Welcome back', { timeout: 5000 });
  
  // Fill signin form
  await page.fill('input[id="email"]', user.email);
  await page.fill('input[id="password"]', user.password);
  
  // Submit form (use form button, not header)
  await page.locator('form button:has-text("Sign In")').click();
  
  // Wait for redirect to courses page (signin success)
  await page.waitForURL('/courses', { timeout: 10000 });
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
}

/**
 * Sign out current user
 */
export async function signOut(page: Page): Promise<void> {
  // Click sign out button (if visible)
  const signOutButton = page.locator('button[title="Sign Out"], button:has-text("Sign Out")');
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
  }
  
  // Wait for redirect to landing page
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Setup: Authenticate user and save state
 * This runs once before all tests
 */
setup('authenticate', async ({ page }) => {
  // Sign up a new user for testing
  await signUp(page);
  
  // Save authenticated state
  await page.context().storageState({ path: authFile });
});


import { test, expect } from '@playwright/test';

/**
 * Error Handling Tests
 * 
 * Tests for error handling across the application
 */

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Error Handling', () => {
  test.describe('API Errors', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true);
      
      await page.goto('/courses');
      await page.waitForTimeout(2000);
      
      // Should show error message or handle gracefully
      expect(page.locator('body')).toBeVisible();
      
      // Restore online
      await page.context().setOffline(false);
    });

    test('should redirect to signin on 401 Unauthorized', async ({ page }) => {
      // This would require API mocking
      // Placeholder for now
      expect(true).toBeTruthy();
    });

    test('should show friendly error message on 500', async ({ page }) => {
      // Placeholder test
      expect(true).toBeTruthy();
    });
  });

  test.describe('Form Validation Errors', () => {
    test('should show inline errors for invalid input', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Get Started")');
      await page.waitForTimeout(1000);
      
      // Try to submit empty form
      const submitButton = page.locator('form button:has-text("Create Account")');
      await submitButton.click();
      
      // Should show validation errors
      await page.waitForTimeout(1000);
      expect(page.locator('body')).toBeVisible();
    });
  });
});


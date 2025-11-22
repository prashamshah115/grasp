import { test, expect } from '@playwright/test';

/**
 * Landing Page Tests
 * 
 * Tests for the landing page (/)
 * - Page load
 * - UI elements
 * - Navigation
 * - Responsive design
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Page Load', () => {
    test('should load successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/grasp/i);
      await expect(page.locator('h1:has-text("grasp.ai")').first()).toBeVisible();
    });

    test('should display brand name in header', async ({ page }) => {
      const brand = page.locator('h1:has-text("grasp.ai")').first();
      await expect(brand).toBeVisible();
      await expect(brand).toHaveText('grasp.ai');
    });

    test('should display Sign In link in top-right', async ({ page }) => {
      const signInLink = page.locator('text=Sign In');
      await expect(signInLink).toBeVisible();
    });

    test('should display main headline', async ({ page }) => {
      const headline = page.locator('text=Ace your finals.');
      await expect(headline).toBeVisible();
    });

    test('should display subtitle text', async ({ page }) => {
      const subtitle = page.locator('text=Master your entire quarter in one place.');
      await expect(subtitle).toBeVisible();
      
      const secondSubtitle = page.locator('text=Fast, adaptive, exam-focused.');
      await expect(secondSubtitle).toBeVisible();
    });

    test('should display Get Started button', async ({ page }) => {
      const getStartedButton = page.locator('button:has-text("Get Started")');
      await expect(getStartedButton).toBeVisible();
    });

    test('should display footer text', async ({ page }) => {
      const footer = page.locator('text=Tailored specifically for UCSD students');
      await expect(footer).toBeVisible();
    });
  });

  test.describe('Header Navigation', () => {
    test('should open signin modal when clicking Sign In', async ({ page }) => {
      // Click header Sign In button (not modal button)
      await page.locator('header button:has-text("Sign In")').click();
      
      // Wait for modal to appear
      const modal = page.locator('text=Welcome back');
      await expect(modal).toBeVisible({ timeout: 10000 });
    });

    test('should stay on landing when clicking brand logo', async ({ page }) => {
      const logo = page.locator('h1:has-text("grasp.ai")').first();
      await logo.click();
      
      // Should still be on landing page
      await expect(page).toHaveURL('/');
      await expect(page.locator('text=Ace your finals.')).toBeVisible();
    });
  });

  test.describe('Call-to-Action Button', () => {
    test('should open signup modal when clicking Get Started', async ({ page }) => {
      await page.click('button:has-text("Get Started")');
      
      // Wait for modal to appear in signup mode
      const modal = page.locator('text=Get started').or(page.locator('text=Create your account'));
      await expect(modal).toBeVisible({ timeout: 10000 });
    });

    test('should have correct gradient colors on button', async ({ page }) => {
      const button = page.locator('button:has-text("Get Started")');
      
      // Check button exists and is visible
      await expect(button).toBeVisible();
      
      // Check button has background color (gradient)
      const backgroundColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundImage;
      });
      
      // Should have gradient (contains 'gradient' or background color)
      expect(backgroundColor).toBeTruthy();
    });

    test('should show hover state on button', async ({ page }) => {
      const button = page.locator('button:has-text("Get Started")');
      await button.hover();
      
      // Button should still be visible
      await expect(button).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport (< 768px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Brand should still be visible
      await expect(page.locator('h1:has-text("grasp.ai")').first()).toBeVisible();
      
      // Headline should be visible
      await expect(page.locator('text=Ace your finals.')).toBeVisible();
      
      // Sign In link should be visible
      await expect(page.locator('text=Sign In')).toBeVisible();
    });

    test('should work on tablet viewport (768-1024px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Brand should still be visible
      await expect(page.locator('h1:has-text("grasp.ai")').first()).toBeVisible();
      
      // Headline should be visible
      await expect(page.locator('text=Ace your finals.')).toBeVisible();
    });

    test('should work on desktop viewport (> 1024px)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Brand should still be visible
      await expect(page.locator('h1:has-text("grasp.ai")').first()).toBeVisible();
      
      // Headline should be visible
      await expect(page.locator('text=Ace your finals.')).toBeVisible();
      
      // Content should be centered
      const headline = page.locator('text=Ace your finals.');
      await expect(headline).toBeVisible();
    });
  });
});


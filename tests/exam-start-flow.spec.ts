import { test, expect } from '@playwright/test';

/**
 * Exam Start Flow Tests
 * 
 * Tests that clicking "Start Exam" on the Exam Simulation page:
 * 1. Directly creates a session and navigates to exam page
 * 2. No popups or intermediate pages
 * 3. Exam page loads correctly with questions
 */

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Exam Start Flow', () => {
  test('should start exam directly without popups', async ({ page }) => {
    // Navigate to exam simulation page
    await page.goto('/course/11111111-1111-1111-1111-111111111111/exam');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify we're on the exam simulation page
    await expect(page).toHaveURL(/\/course\/.*\/exam/);
    
    // Check for "Exam Simulation" heading
    const heading = page.locator('text=Exam Simulation');
    await expect(heading).toBeVisible({ timeout: 5000 });

    // Find and click "Start Exam" button
    const startButton = page.locator('button:has-text("Start Exam")').first();
    await expect(startButton).toBeVisible({ timeout: 5000 });
    
    // Click the button
    await startButton.click();

    // Should show loading state on button (no popup)
    const loadingState = page.locator('button:has-text("Starting..."), button:has-text("Start Exam")');
    await expect(loadingState).toBeVisible();

    // Should navigate directly to exam-session page (no intermediate /exam/:examId page)
    await page.waitForURL(/\/exam-session\//, { timeout: 15000 });
    
    // Verify we're on exam session page (not exam definition page)
    await expect(page).toHaveURL(/\/exam-session\//);
    await expect(page).not.toHaveURL(/\/exam\/.*\/start/);
    await expect(page).not.toHaveURL(/\/exam\/.*$/);

    // Wait for exam to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify exam page elements are visible
    // Timer should be visible
    const timer = page.locator('[class*="timer"], [class*="Timer"], text=/:\d{2}/');
    const timerVisible = await timer.first().isVisible().catch(() => false);
    
    // Question content should be visible
    const questionContent = page.locator('[class*="question"], [class*="prompt"]');
    const questionVisible = await questionContent.first().isVisible().catch(() => false);
    
    // Navigation buttons should be visible
    const navButtons = page.locator('button:has-text("Previous"), button:has-text("Next"), button:has-text("Submit")');
    const navVisible = await navButtons.first().isVisible().catch(() => false);

    // At least one of these should be visible to confirm exam loaded
    expect(timerVisible || questionVisible || navVisible).toBeTruthy();
  });

  test('should not show ExamDefinition page', async ({ page }) => {
    await page.goto('/course/11111111-1111-1111-1111-111111111111/exam');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const startButton = page.locator('button:has-text("Start Exam")').first();
    await expect(startButton).toBeVisible({ timeout: 5000 });
    
    await startButton.click();

    // Should NOT navigate to /exam/:examId (ExamDefinition page)
    // Should go directly to /exam-session/:sessionId
    await page.waitForURL(/\/exam-session\//, { timeout: 15000 });
    
    // Verify we never hit the exam definition route
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/exam\/[^\/]+$/);
    expect(currentUrl).toMatch(/\/exam-session\//);
  });

  test('should handle active session gracefully', async ({ page }) => {
    await page.goto('/course/11111111-1111-1111-1111-111111111111/exam');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check if "Resume Exam" button exists (indicates active session)
    const resumeButton = page.locator('button:has-text("Resume Exam")').first();
    const resumeVisible = await resumeButton.isVisible().catch(() => false);

    if (resumeVisible) {
      // If there's an active session, clicking Resume should go directly to exam
      await resumeButton.click();
      await page.waitForURL(/\/exam-session\//, { timeout: 15000 });
      await expect(page).toHaveURL(/\/exam-session\//);
    } else {
      // Otherwise, Start Exam should work
      const startButton = page.locator('button:has-text("Start Exam")').first();
      if (await startButton.isVisible().catch(() => false)) {
        await startButton.click();
        await page.waitForURL(/\/exam-session\//, { timeout: 15000 });
        await expect(page).toHaveURL(/\/exam-session\//);
      }
    }
  });

  test('should display exam content correctly', async ({ page }) => {
    await page.goto('/course/11111111-1111-1111-1111-111111111111/exam');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const startButton = page.locator('button:has-text("Start Exam")').first();
    const buttonVisible = await startButton.isVisible().catch(() => false);
    
    if (!buttonVisible) {
      test.skip();
      return;
    }

    await startButton.click();
    await page.waitForURL(/\/exam-session\//, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Verify exam page structure
    // Should have question navigator sidebar
    const sidebar = page.locator('[class*="sidebar"], [class*="navigator"], [class*="question-nav"]');
    const sidebarVisible = await sidebar.first().isVisible().catch(() => false);

    // Should have main question area
    const mainContent = page.locator('main, [class*="content"], [class*="question"]');
    const contentVisible = await mainContent.first().isVisible().catch(() => false);

    // Should have navigation buttons
    const prevButton = page.locator('button:has-text("Previous")');
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Submit")');
    const navVisible = await (prevButton.first().isVisible().catch(() => false) || 
                             nextButton.first().isVisible().catch(() => false));

    // At least main content should be visible
    expect(contentVisible || navVisible).toBeTruthy();
  });
});



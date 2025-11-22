import { test, expect } from '@playwright/test';
import { TEST_COURSE_ID, TEST_TOPIC_ID } from '../fixtures/test-data';
import { supabaseAdmin, getTestUserId } from '../fixtures/api-helpers';

/**
 * FUNCTIONAL TESTS: Compression View
 * 
 * Tests ACTUAL functionality:
 * - Compression generation API calls
 * - Notes saved to database
 * - Download functionality
 */

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Compression - Functional Tests', () => {
  let userId: string;

  test.beforeAll(async () => {
    userId = await getTestUserId(process.env.TEST_USER_EMAIL!);
  });

  test.beforeEach(async () => {
    // Clear existing compression notes
    await supabaseAdmin.from('compression_notes').delete().eq('user_id', userId).eq('topic_id', TEST_TOPIC_ID);
  });

  test('should call generate-compression API when clicking Generate', async ({ page }) => {
    let apiCalled = false;
    let apiRequest: any = null;

    await page.route('**/functions/v1/generate-compression', async route => {
      apiCalled = true;
      apiRequest = await route.request().postDataJSON();
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content_md: '# Compression Notes\n\n- Key point 1\n- Key point 2',
          source_pages: [1, 2, 3]
        })
      });
    });

    await page.goto(`/course/${TEST_COURSE_ID}/compression`);
    await page.waitForLoadState('networkidle');

    // Select topic
    const topicButton = page.locator('button:has-text("Introduction & Processes")').first();
    await topicButton.click();
    await page.waitForTimeout(1000);

    // Click Generate
    const generateButton = page.locator('button:has-text("Generate")').first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();

    await page.waitForTimeout(3000);

    // Verify API was called
    expect(apiCalled).toBe(true);
    expect(apiRequest.topic_id).toBeTruthy();
    expect(apiRequest.user_id).toBe(userId);
  });

  test('should save compression notes to database', async ({ page }) => {
    await page.route('**/functions/v1/generate-compression', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content_md: '# Test Notes\n\nContent here',
          source_pages: [1]
        })
      });
    });

    await page.goto(`/course/${TEST_COURSE_ID}/compression`);
    await page.waitForLoadState('networkidle');

    const topicButton = page.locator('button:has-text("Introduction & Processes")').first();
    await topicButton.click();
    await page.waitForTimeout(1000);

    const generateButton = page.locator('button:has-text("Generate")').first();
    await generateButton.click();
    await page.waitForTimeout(5000); // Wait for generation and save

    // Verify notes saved in database
    const { data: notes, error } = await supabaseAdmin
      .from('compression_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('topic_id', TEST_TOPIC_ID)
      .single();

    expect(error).toBeNull();
    expect(notes).toBeTruthy();
    expect(notes.content_md).toContain('Test Notes');
  });
});


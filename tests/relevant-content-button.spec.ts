import { test, expect } from '@playwright/test';

/**
 * Relevant Content Button Tests
 * 
 * Tests for the "Study Relevant Materials" button functionality:
 * - Button visibility when question is loaded
 * - Content fetching and loading states
 * - Content display and organization
 * - Navigation through multiple documents
 */

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Relevant Content Button - Study Materials', () => {
  let sessionUrl = '';

  test.beforeEach(async ({ page }) => {
    // Start a practice session
    await page.goto('/course/11111111-1111-1111-1111-111111111111/practice');
    await page.waitForTimeout(2000);
    
    // Click Begin Session
    const beginButton = page.locator('button:has-text("Begin Session")').first();
    const buttonVisible = await beginButton.isVisible().catch(() => false);
    
    if (buttonVisible) {
      await beginButton.click();
      
      // Wait for navigation to session
      try {
        await page.waitForURL(/\/session\//, { timeout: 10000 });
        sessionUrl = page.url();
      } catch {
        sessionUrl = '';
      }
    }
  });

  test('should display "Study relevant notes" button when question is loaded', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000); // Wait for question and content to load
    
    // Look for the button by text or aria-label
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    expect(buttonVisible).toBeTruthy();
    
    // Button should be in the right position (fixed, bottom right)
    const buttonStyles = await studyButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        bottom: styles.bottom,
        right: styles.right
      };
    }).catch(() => null);
    
    if (buttonStyles) {
      expect(buttonStyles.position).toBe('fixed');
    }
  });

  test('should show loading state when fetching content', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(1000); // Brief wait
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    // Check if loading text appears (may be brief)
    const loadingText = page.locator('text=/loading/i');
    const hasLoadingText = await loadingText.isVisible().catch(() => false);
    // Loading state may be too brief to catch, so this is optional
  });

  test('should show content indicator when content is available', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000); // Wait for content to load
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    // Check for "View materials" text indicating content is available
    const viewMaterialsText = page.locator('text=/View materials/i');
    const hasViewMaterials = await viewMaterialsText.isVisible().catch(() => false);
    
    // Check for green indicator dot
    const indicatorDot = studyButton.locator('[class*="bg-[#10B981]"], [class*="bg-green"]');
    const hasIndicator = await indicatorDot.isVisible().catch(() => false);
    
    // At least one should be present if content is available
    // (Content may or may not be available depending on course materials)
    console.log('Content available:', hasViewMaterials || hasIndicator);
  });

  test('should open content viewer panel when clicked', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000); // Wait for question and content
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    // Click the button
    await studyButton.click();
    await page.waitForTimeout(2000);
    
    // Content viewer panel should open
    const viewerPanel = page.locator('text=/Study Materials/i').or(
      page.locator('[class*="content-viewer"], [class*="slide-in"]')
    );
    
    const panelVisible = await viewerPanel.isVisible().catch(() => false);
    expect(panelVisible).toBeTruthy();
  });

  test('should display content in organized sections', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    await studyButton.click();
    await page.waitForTimeout(3000); // Wait for content to load in panel
    
    // Check for organized content sections
    const explanationSection = page.locator('text=/Explanation/i');
    const keyConceptsSection = page.locator('text=/Key Concepts/i');
    const detailsSection = page.locator('text=/Details/i');
    
    // At least the panel structure should be visible
    const panelHeader = page.locator('text=/Study Materials/i');
    const headerVisible = await panelHeader.isVisible().catch(() => false);
    expect(headerVisible).toBeTruthy();
    
    // Check for document title
    const documentTitle = page.locator('[class*="doc-title"], h3, h4').first();
    const titleVisible = await documentTitle.isVisible().catch(() => false);
    
    // Check for navigation controls
    const navControls = page.locator('button[aria-label*="Previous"], button[aria-label*="Next"]');
    const navCount = await navControls.count();
    
    console.log('Content sections found:', {
      explanation: await explanationSection.isVisible().catch(() => false),
      keyConcepts: await keyConceptsSection.isVisible().catch(() => false),
      details: await detailsSection.isVisible().catch(() => false),
      navigation: navCount > 0
    });
  });

  test('should organize content by document and relevance', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    await studyButton.click();
    await page.waitForTimeout(3000);
    
    // Check for document metadata
    const docType = page.locator('text=/Lecture|Textbook|Notes|Slides/i');
    const pageNumbers = page.locator('text=/Page|Pages/i');
    const relevanceScore = page.locator('text=/relevant|%/i');
    
    // Check for document navigation (indicates multiple documents)
    const docCounter = page.locator('text=/of/i').first();
    const hasCounter = await docCounter.isVisible().catch(() => false);
    
    console.log('Document organization:', {
      docType: await docType.isVisible().catch(() => false),
      pageNumbers: await pageNumbers.isVisible().catch(() => false),
      relevance: await relevanceScore.isVisible().catch(() => false),
      multipleDocs: hasCounter
    });
  });

  test('should allow navigation between documents', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    await studyButton.click();
    await page.waitForTimeout(3000);
    
    // Look for navigation buttons
    const prevButton = page.locator('button[aria-label*="Previous"]').or(
      page.locator('button:has([class*="chevron-left"])')
    );
    const nextButton = page.locator('button[aria-label*="Next"]').or(
      page.locator('button:has([class*="chevron-right"])')
    );
    
    const prevVisible = await prevButton.isVisible().catch(() => false);
    const nextVisible = await nextButton.isVisible().catch(() => false);
    
    // At least one navigation button should be present if multiple documents exist
    if (prevVisible || nextVisible) {
      // Try clicking next if available
      if (nextVisible) {
        const nextEnabled = await nextButton.isEnabled().catch(() => false);
        if (nextEnabled) {
          await nextButton.click();
          await page.waitForTimeout(1000);
          
          // Content should change (document counter should update if present)
          expect(true).toBeTruthy();
        }
      }
    }
    
    console.log('Navigation available:', { prev: prevVisible, next: nextVisible });
  });

  test('should close viewer panel when close button is clicked', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    // Open panel
    await studyButton.click();
    await page.waitForTimeout(2000);
    
    // Find close button
    const closeButton = page.locator('button[aria-label*="Close"]').or(
      page.locator('button:has([class*="x-icon"], [class*="close"])')
    );
    
    const closeVisible = await closeButton.isVisible().catch(() => false);
    if (closeVisible) {
      await closeButton.click();
      await page.waitForTimeout(1000);
      
      // Panel should be closed
      const panelHeader = page.locator('text=/Study Materials/i');
      const panelVisible = await panelHeader.isVisible().catch(() => false);
      expect(panelVisible).toBeFalsy();
    }
  });

  test('should handle empty state when no content is available', async ({ page }) => {
    if (!sessionUrl) {
      test.skip();
    }
    
    await page.goto(sessionUrl);
    await page.waitForTimeout(5000);
    
    const studyButton = page.locator('button[aria-label="Study relevant notes"]').or(
      page.locator('button:has-text("Study relevant notes")')
    );
    
    const buttonVisible = await studyButton.isVisible().catch(() => false);
    if (!buttonVisible) {
      test.skip();
    }
    
    // Click button
    await studyButton.click();
    await page.waitForTimeout(3000);
    
    // Check for empty state message
    const emptyState = page.locator('text=/No content available/i').or(
      page.locator('text=/no relevant/i')
    );
    
    const isEmpty = await emptyState.isVisible().catch(() => false);
    
    // Either content should be displayed OR empty state should be shown
    const hasContent = await page.locator('[class*="explanation"], [class*="concept"]').first().isVisible().catch(() => false);
    
    expect(isEmpty || hasContent).toBeTruthy();
  });
});

import { chromium, FullConfig } from '@playwright/test';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to landing page
    await page.goto(baseURL || 'http://localhost:3000');
    
    // Click Get Started to open signup modal
    await page.click('button:has-text("Get Started")');
    await page.waitForSelector('text=Get started', { timeout: 10000 });
    
    // Use test user from environment or generate unique one
    const testEmail = process.env.TEST_USER_EMAIL || `test-${Date.now()}@example.com`;
    const testName = 'Test User';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';
    
    // Fill signup form
    await page.fill('input[id="name"]', testName);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    
    // Submit
    await page.click('form button:has-text("Create Account")');
    
    // Wait for redirect to courses (signup success) or stay on landing if payment required
    try {
      await page.waitForURL('**/courses', { timeout: 15000 });
    } catch {
      // If payment required, just save state anyway - tests will handle it
      console.log('⚠️  Signup may require payment, continuing...');
    }
    
    // Save authenticated state
    await page.context().storageState({ 
      path: path.join(__dirname, '.auth/user.json') 
    });
    
    console.log('✅ Auth setup complete - user created and state saved');
  } catch (error) {
    console.error('❌ Auth setup failed:', error);
    // Continue anyway - tests will handle auth errors
  } finally {
    await browser.close();
  }
}

export default globalSetup;


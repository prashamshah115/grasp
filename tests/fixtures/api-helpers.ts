import type { Page, APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * API Helper Functions
 * 
 * Utilities for making API calls during tests
 */

function getEnvVar(name: string, viteName?: string): string {
  const value = process.env[name] || process.env[viteName || `VITE_${name}`] || '';
  if (!value) {
    throw new Error(`Missing ${name} or ${viteName || `VITE_${name}`} environment variable. Set it in .env.test`);
  }
  return value;
}

// Lazy-load supabase admin client
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const SUPABASE_URL = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    _supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabaseAdmin;
}

// Export proxy that lazy-loads
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    return (getSupabaseAdmin() as any)[prop];
  }
}) as ReturnType<typeof createClient<Database>>;

export async function clearUserSessions(userId: string) {
  const admin = getSupabaseAdmin();
  await admin.from('study_sessions').delete().eq('user_id', userId);
  await admin.from('exam_sessions').delete().eq('user_id', userId);
  await admin.from('question_attempts').delete().eq('user_id', userId);
  await admin.from('question_history').delete().eq('user_id', userId);
  await admin.from('topic_mastery').delete().eq('user_id', userId);
  await admin.from('compression_notes').delete().eq('user_id', userId);
  await admin.from('user_courses').delete().eq('user_id', userId);
  await admin.from('course_uploads').delete().eq('user_id', userId);
}

export async function getTestUserId(email: string): Promise<string> {
  const SUPABASE_URL = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  
  // Use REST API to get user by email
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data.users || data.users.length === 0) {
    throw new Error(`User not found: ${email}`);
  }
  
  return data.users[0].id;
}

/**
 * Make authenticated request to Supabase Edge Function
 */
export async function callEdgeFunction(
  request: APIRequestContext,
  functionName: string,
  body: any,
  token?: string
): Promise<any> {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    data: body,
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Edge function ${functionName} failed: ${error}`);
  }

  return await response.json();
}

/**
 * Get authentication token from page localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const supabaseKey = keys.find(key => key.includes('supabase.auth.token'));
    if (supabaseKey) {
      const tokenData = localStorage.getItem(supabaseKey);
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          return parsed?.access_token || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
}

/**
 * Wait for API request to complete
 */
export async function waitForAPIRequest(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 30000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Mock API response
 */
export async function mockAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  mockData: any
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockData),
    });
  });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}


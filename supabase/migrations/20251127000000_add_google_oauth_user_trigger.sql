-- Migration: Auto-create user records for Google OAuth signups
-- Description: Automatically creates a user record in public.users table when a new user signs up via Google OAuth
-- This ensures Google profile data (name, avatar) is synced to your users table

-- ============================================
-- 1. CREATE FUNCTION TO HANDLE NEW USER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into public.users table with Google OAuth metadata
  -- Adjust column names to match your actual users table structure
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url'
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. CREATE TRIGGER ON AUTH.USERS
-- ============================================

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after a new user is inserted
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- NOTES:
-- ============================================
-- This trigger will fire for ALL new user signups (email/password AND OAuth)
-- 
-- If your public.users table has different column names, update the INSERT statement above.
-- Common variations:
--   - name instead of full_name
--   - picture_url instead of avatar_url
--   - user_id instead of id (if using a separate primary key)
--
-- The ON CONFLICT clause handles cases where a user record might already exist
-- (e.g., if manually created before OAuth signup)



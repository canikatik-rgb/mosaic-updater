-- Simplified: Check and add email to profiles
-- Run in Supabase SQL Editor

-- 1. First, see what columns exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';

-- 2. Add email column if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Populate email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 4. Check result
SELECT id, email FROM profiles LIMIT 5;

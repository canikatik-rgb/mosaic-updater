-- Profiles Enhancement Schema for Mosaic
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ADD EMAIL COLUMN TO PROFILES
-- =============================================

-- Add email column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Backfill emails from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- =============================================
-- 2. FIX DISPLAY NAMES (where email was used as name)
-- =============================================

-- Update display_name if it looks like an email address
UPDATE profiles p
SET display_name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id 
  AND p.display_name LIKE '%@%'
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL;

-- =============================================
-- 3. ENSURE handle_new_user TRIGGER POPULATES EMAIL
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. STORAGE CALCULATION
-- =============================================

-- Add storage column if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- Function to calculate user's storage usage
CREATE OR REPLACE FUNCTION calculate_user_storage(user_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    total_bytes BIGINT := 0;
    project_bytes BIGINT := 0;
    thumbnail_bytes BIGINT := 0;
BEGIN
    -- Calculate project data size (JSONB)
    SELECT COALESCE(SUM(octet_length(data::TEXT)), 0)
    INTO project_bytes
    FROM projects
    WHERE user_id = user_uuid;
    
    -- Calculate thumbnail size (base64 images stored as text)
    SELECT COALESCE(SUM(octet_length(thumbnail)), 0)
    INTO thumbnail_bytes
    FROM projects
    WHERE user_id = user_uuid AND thumbnail IS NOT NULL;
    
    total_bytes := project_bytes + thumbnail_bytes;
    
    RETURN total_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user's storage after project changes
CREATE OR REPLACE FUNCTION update_user_storage()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Determine which user to update
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
    ELSE
        target_user_id := NEW.user_id;
    END IF;
    
    -- Update storage in profiles
    UPDATE profiles
    SET storage_used_bytes = calculate_user_storage(target_user_id),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update storage on project changes
DROP TRIGGER IF EXISTS trigger_update_storage ON projects;
CREATE TRIGGER trigger_update_storage
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_user_storage();

-- =============================================
-- 5. INITIAL STORAGE CALCULATION FOR EXISTING USERS
-- =============================================

-- Run this once to calculate storage for all existing users
UPDATE profiles p
SET storage_used_bytes = calculate_user_storage(p.id),
    updated_at = NOW();

-- =============================================
-- 6. VERIFY DATA
-- =============================================

-- Check results (run as SELECT query)
-- SELECT id, display_name, email, storage_used_bytes FROM profiles;

-- P2P Schema FIX - Run this to fix existing table
-- Run in Supabase SQL Editor

-- =============================================
-- 1. ADD UNIQUE CONSTRAINT (for upsert to work)
-- =============================================

-- First, delete any duplicate entries if they exist
DELETE FROM shared_projects a
USING shared_projects b
WHERE a.id > b.id 
  AND a.project_id = b.project_id 
  AND a.host_user_id = b.host_user_id;

-- Add unique constraint (safe - will error if already exists)
DO $$
BEGIN
    ALTER TABLE shared_projects ADD CONSTRAINT shared_projects_project_host_unique 
    UNIQUE (project_id, host_user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN
    -- Constraint already exists, ignore
    RAISE NOTICE 'Unique constraint already exists';
END;
$$;

-- Add GIN index for efficient array search
CREATE INDEX IF NOT EXISTS idx_shared_emails 
ON shared_projects USING GIN(invited_emails);

-- =============================================
-- 2. FIX RLS POLICIES
-- =============================================

-- Drop the broken policy
DROP POLICY IF EXISTS "Anyone can see shared projects" ON shared_projects;

-- Drop old policies to recreate
DROP POLICY IF EXISTS "Host manages shared projects" ON shared_projects;
DROP POLICY IF EXISTS "Invited users can see" ON shared_projects;

-- Recreate: Host can do everything with their projects
CREATE POLICY "Host manages shared projects" ON shared_projects
    FOR ALL TO authenticated
    USING (host_user_id = auth.uid())
    WITH CHECK (host_user_id = auth.uid());

-- Recreate: Invited users can VIEW projects (using JWT email, not auth.users query)
CREATE POLICY "Invited users can see" ON shared_projects
    FOR SELECT TO authenticated
    USING (
        (auth.jwt() ->> 'email')::TEXT = ANY(invited_emails)
    );

-- =============================================
-- 3. VERIFY
-- =============================================

-- Check if policies are created
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'shared_projects';

-- TEMPORARY FIX: Disable RLS to restore access
-- Run this in Supabase SQL Editor

-- =============================================
-- OPTION A: TEMPORARILY DISABLE RLS (Quick fix)
-- =============================================

-- This will make projects accessible while we debug
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Also disable on project_collaborators if needed
ALTER TABLE project_collaborators DISABLE ROW LEVEL SECURITY;

-- =============================================
-- After running this, your projects should be visible again
-- This is a TEMPORARY measure - we'll re-enable RLS properly later
-- =============================================

-- To verify it worked:
-- SELECT * FROM projects LIMIT 5;

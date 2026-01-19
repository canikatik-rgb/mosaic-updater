-- Multiplayer & Collaboration Schema for Mosaic
-- Run this in Supabase SQL Editor

-- 0. Safety: Drop existing table to avoid conflicts (WARNING: Data Loss)
-- If you are already using this table, comment this out.
DROP TABLE IF EXISTS project_collaborators CASCADE;

-- 1. Create table for project collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable for pending invites via email
    email TEXT, -- For pending invites or mapping
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id),      -- One role per user per project
    UNIQUE(project_id, email)         -- One role per email per project
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_email ON project_collaborators(email);

-- 2. Enable RLS on collaborators
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTION: Check if user has access to project
CREATE OR REPLACE FUNCTION public.has_project_access(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_id AND (user_id = auth.uid() OR is_public = true)
    ) OR EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_id = project_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE PROJECTS POLICIES
-- Drop existing policies to be safe before recreating
DROP POLICY IF EXISTS "Collaborators can view projects" ON projects;
DROP POLICY IF EXISTS "Collaborators can update projects" ON projects;

-- Collaborators can view projects
CREATE POLICY "Collaborators can view projects" ON projects
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM project_collaborators WHERE project_id = id
        )
    );

-- Collaborators (editors) can update projects
CREATE POLICY "Collaborators can update projects" ON projects
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM project_collaborators 
            WHERE project_id = id AND role IN ('editor', 'owner')
        )
    );

-- 5. COLLABORATORS POLICIES
DROP POLICY IF EXISTS "View collaborators" ON project_collaborators;
DROP POLICY IF EXISTS "Owners manage collaborators" ON project_collaborators;

-- Users can view collaborators for projects they have access to
CREATE POLICY "View collaborators" ON project_collaborators
    FOR SELECT USING (
        -- User is the project owner
        EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
        OR
        -- User is a collaborator themselves
        auth.uid() IN (
            SELECT user_id FROM project_collaborators WHERE project_id = project_collaborators.project_id
        )
    );

-- Only Project Owners can manage collaborators
CREATE POLICY "Owners manage collaborators" ON project_collaborators
    FOR ALL USING (
        EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
    );

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS update_collaborators_updated_at ON project_collaborators;
CREATE TRIGGER update_collaborators_updated_at
    BEFORE UPDATE ON project_collaborators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Realtime
-- Add project_collaborators to realtime publication so UI updates when someone is added
ALTER PUBLICATION supabase_realtime ADD TABLE project_collaborators;

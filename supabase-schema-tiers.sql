-- Mosaic Subscription Tiers Schema Update
-- Run this in Supabase SQL Editor AFTER the initial schema

-- ============================================
-- ADD SUBSCRIPTION FIELDS TO PROFILES
-- ============================================

-- Add subscription tier column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' 
    CHECK (subscription_tier IN ('free', 'pro', 'team'));

-- Add storage limit tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- Add subscription expiration
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Add team reference (for team members)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS team_id UUID;

-- ============================================
-- TIER LIMITS REFERENCE
-- ============================================
-- free: 3 cloud projects, 100MB storage, 1 collaborator
-- pro:  unlimited projects, 5GB storage, 5 collaborators
-- team: unlimited projects, 50GB shared storage, unlimited collaborators

-- ============================================
-- STORAGE LIMITS (in bytes)
-- ============================================
-- free: 104857600 (100 MB)
-- pro:  5368709120 (5 GB)
-- team: 53687091200 (50 GB)

-- ============================================
-- COLLABORATORS TABLE (for project sharing)
-- ============================================
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'commenter', 'editor')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators can see projects they're invited to
CREATE POLICY "Users can view their collaborations" ON project_collaborators
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = invited_by);

-- Project owners can manage collaborators
CREATE POLICY "Project owners can manage collaborators" ON project_collaborators
    FOR ALL USING (
        auth.uid() = invited_by OR 
        auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
    );

-- ============================================
-- TEAMS TABLE (for Team tier)
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_used_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Team members can view their team
CREATE POLICY "Team members can view team" ON teams
    FOR SELECT USING (
        auth.uid() = owner_id OR
        auth.uid() IN (SELECT id FROM profiles WHERE team_id = teams.id)
    );

-- Only owners can update team
CREATE POLICY "Team owners can update team" ON teams
    FOR UPDATE USING (auth.uid() = owner_id);

-- ============================================
-- SHARED ASSETS TABLE (Team Files)
-- ============================================
CREATE TABLE IF NOT EXISTS team_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT, -- 'logo', 'font', 'image', 'other'
    file_size BIGINT DEFAULT 0,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE team_assets ENABLE ROW LEVEL SECURITY;

-- Team members can view team assets
CREATE POLICY "Team members can view assets" ON team_assets
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );

-- Team members can upload assets
CREATE POLICY "Team members can upload assets" ON team_assets
    FOR INSERT WITH CHECK (
        team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user can create cloud project
CREATE OR REPLACE FUNCTION can_create_cloud_project(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier TEXT;
    project_count INTEGER;
BEGIN
    SELECT subscription_tier INTO user_tier FROM profiles WHERE id = user_uuid;
    
    -- Pro and Team have unlimited projects
    IF user_tier IN ('pro', 'team') THEN
        RETURN TRUE;
    END IF;
    
    -- Free users: max 3 cloud projects
    SELECT COUNT(*) INTO project_count FROM projects WHERE user_id = user_uuid;
    RETURN project_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check collaborator limit
CREATE OR REPLACE FUNCTION can_add_collaborator(project_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    owner_tier TEXT;
    collab_count INTEGER;
BEGIN
    SELECT p.subscription_tier INTO owner_tier 
    FROM profiles p 
    JOIN projects pr ON pr.user_id = p.id 
    WHERE pr.id = project_uuid;
    
    SELECT COUNT(*) INTO collab_count FROM project_collaborators WHERE project_id = project_uuid;
    
    IF owner_tier = 'team' THEN
        RETURN TRUE; -- Unlimited
    ELSIF owner_tier = 'pro' THEN
        RETURN collab_count < 5;
    ELSE
        RETURN collab_count < 1; -- Free: 1 collaborator
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get storage limit for user
CREATE OR REPLACE FUNCTION get_storage_limit(user_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    user_tier TEXT;
BEGIN
    SELECT subscription_tier INTO user_tier FROM profiles WHERE id = user_uuid;
    
    CASE user_tier
        WHEN 'team' THEN RETURN 53687091200; -- 50 GB
        WHEN 'pro' THEN RETURN 5368709120;   -- 5 GB
        ELSE RETURN 104857600;               -- 100 MB
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

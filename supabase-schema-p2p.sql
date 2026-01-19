-- P2P Signaling Schema for Mosaic
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. SIGNALING TABLE (WebRTC offer/answer exchange)
-- =============================================

CREATE TABLE IF NOT EXISTS p2p_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID,
    signal_type TEXT CHECK (signal_type IN ('offer', 'answer', 'ice')),
    signal_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 minute')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_signals_to_user ON p2p_signals(to_user);
CREATE INDEX IF NOT EXISTS idx_signals_project ON p2p_signals(project_id);

-- =============================================
-- 2. SHARED PROJECTS TABLE (P2P project registry)
-- =============================================

CREATE TABLE IF NOT EXISTS shared_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL, -- Local project ID (not cloud)
    host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    thumbnail TEXT, -- Base64 thumbnail
    invited_emails TEXT[], -- Array of invited emails
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- UNIQUE constraint for upsert
    UNIQUE(project_id, host_user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shared_host ON shared_projects(host_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_emails ON shared_projects USING GIN(invited_emails);

-- =============================================
-- 3. RLS POLICIES
-- =============================================

ALTER TABLE p2p_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users see own signals" ON p2p_signals;
DROP POLICY IF EXISTS "Users can send signals" ON p2p_signals;
DROP POLICY IF EXISTS "Users delete own signals" ON p2p_signals;
DROP POLICY IF EXISTS "Anyone can see shared projects" ON shared_projects;
DROP POLICY IF EXISTS "Host manages shared projects" ON shared_projects;
DROP POLICY IF EXISTS "Invited users can see" ON shared_projects;

-- Signals: Users can see signals addressed to them
CREATE POLICY "Users see own signals" ON p2p_signals
    FOR SELECT TO authenticated
    USING (to_user = auth.uid() OR from_user = auth.uid());

-- Signals: Users can insert signals
CREATE POLICY "Users can send signals" ON p2p_signals
    FOR INSERT TO authenticated
    WITH CHECK (from_user = auth.uid());

-- Signals: Users can delete their own signals
CREATE POLICY "Users delete own signals" ON p2p_signals
    FOR DELETE TO authenticated
    USING (from_user = auth.uid() OR to_user = auth.uid());

-- Shared projects: Host can see their own projects
CREATE POLICY "Host manages shared projects" ON shared_projects
    FOR ALL TO authenticated
    USING (host_user_id = auth.uid())
    WITH CHECK (host_user_id = auth.uid());

-- Shared projects: Invited users can SELECT (view) shared projects
-- Using auth.jwt() to get email without querying auth.users table
CREATE POLICY "Invited users can see" ON shared_projects
    FOR SELECT TO authenticated
    USING (
        (auth.jwt() ->> 'email')::TEXT = ANY(invited_emails)
    );

-- =============================================
-- 4. ENABLE REALTIME (safe - ignores if already added)
-- =============================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE p2p_signals;
EXCEPTION WHEN duplicate_object THEN
    -- Already added, ignore
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_projects;
EXCEPTION WHEN duplicate_object THEN
    -- Already added, ignore
END;
$$;

-- =============================================
-- 5. AUTO-CLEANUP OLD SIGNALS (optional cron job)
-- =============================================

-- Run periodically to clean expired signals:
-- DELETE FROM p2p_signals WHERE expires_at < NOW();

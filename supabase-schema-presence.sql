-- User Presence Schema for Mosaic
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. PRESENCE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
    is_visible BOOLEAN DEFAULT true, -- false = invisible mode (appear offline)
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    current_project_id UUID, -- which project they're working on
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);

-- =============================================
-- 2. ENABLE RLS (Simple policies)
-- =============================================

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Everyone can see online status (for collaboration)
CREATE POLICY "Anyone can view presence" ON user_presence
    FOR SELECT TO authenticated USING (true);

-- Users can only update their own presence
CREATE POLICY "Users update own presence" ON user_presence
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Users can insert their own presence
CREATE POLICY "Users insert own presence" ON user_presence
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================
-- 3. AUTO-CREATE PRESENCE ON USER SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_presence()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, status)
    VALUES (NEW.id, 'offline')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_presence ON auth.users;
CREATE TRIGGER on_auth_user_created_presence
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_presence();

-- =============================================
-- 4. BACKFILL EXISTING USERS
-- =============================================

INSERT INTO user_presence (user_id, status)
SELECT id, 'offline' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- 5. ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

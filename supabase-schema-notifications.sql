-- Notifications Schema for Mosaic
-- Run this in Supabase SQL Editor

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'project_shared', 'comment', 'mention', etc.
    title TEXT NOT NULL,
    message TEXT,
    data JSONB, -- Additional data (project_id, sender_id, etc.)
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow the system (service role) or authenticated users to create notifications for others
-- This is needed for share invites to create notifications
CREATE POLICY "Allow creating notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 6. OPTIONAL: Trigger to auto-create notification when project is shared
-- This creates a notification when a new collaborator is added
CREATE OR REPLACE FUNCTION notify_on_share()
RETURNS TRIGGER AS $$
DECLARE
    project_name TEXT;
    owner_name TEXT;
    target_user_id UUID;
BEGIN
    -- Get project name
    SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;
    
    -- Get owner name
    SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.invited_by;
    
    -- Determine target user (might be null for email-only invites)
    target_user_id := NEW.user_id;
    
    -- If user_id is null but email matches an existing user, find them
    IF target_user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO target_user_id FROM auth.users WHERE email = NEW.email;
    END IF;
    
    -- Only create notification if we have a target user
    IF target_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
            target_user_id,
            'project_shared',
            'Project shared with you',
            COALESCE(owner_name, 'Someone') || ' shared "' || COALESCE(project_name, 'a project') || '" with you',
            jsonb_build_object('project_id', NEW.project_id, 'role', NEW.role)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_on_share ON project_collaborators;
CREATE TRIGGER trigger_notify_on_share
    AFTER INSERT ON project_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_share();

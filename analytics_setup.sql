-- Create analytics_events table for tracking usage
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type 
ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user 
ON analytics_events(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created 
ON analytics_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all analytics
CREATE POLICY "Admins can view all analytics"
ON analytics_events FOR SELECT
TO authenticated
USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert their own events"
ON analytics_events FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to get analytics summary
CREATE OR REPLACE FUNCTION get_analytics_summary(days_back INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_messages', (
            SELECT COUNT(*) 
            FROM analytics_events 
            WHERE event_type = 'chat_message' 
            AND created_at > NOW() - (days_back || ' days')::INTERVAL
        ),
        'unique_users', (
            SELECT COUNT(DISTINCT user_id) 
            FROM analytics_events 
            WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
        ),
        'avg_response_time', (
            SELECT AVG((metadata->>'response_time_ms')::FLOAT) 
            FROM analytics_events 
            WHERE event_type = 'chat_message' 
            AND metadata->>'response_time_ms' IS NOT NULL
            AND created_at > NOW() - (days_back || ' days')::INTERVAL
        ),
        'top_questions', (
            SELECT json_agg(question_data)
            FROM (
                SELECT 
                    metadata->>'question' as question,
                    COUNT(*) as count
                FROM analytics_events
                WHERE event_type = 'chat_message'
                AND created_at > NOW() - (days_back || ' days')::INTERVAL
                GROUP BY metadata->>'question'
                ORDER BY count DESC
                LIMIT 10
            ) question_data
        ),
        'messages_by_day', (
            SELECT json_agg(day_data)
            FROM (
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM analytics_events
                WHERE event_type = 'chat_message'
                AND created_at > NOW() - (days_back || ' days')::INTERVAL
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            ) day_data
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

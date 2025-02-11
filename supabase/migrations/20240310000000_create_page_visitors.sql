-- Create the page_visitors table
CREATE TABLE IF NOT EXISTS page_visitors (
  ip_address TEXT PRIMARY KEY,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
  page TEXT NOT NULL
);

-- Create an index on last_seen for faster queries
CREATE INDEX IF NOT EXISTS idx_page_visitors_last_seen ON page_visitors(last_seen);

-- Enable row level security
ALTER TABLE page_visitors ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to insert/update their own IP
CREATE POLICY "Allow anyone to insert/update their own IP"
  ON page_visitors
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to clean up old records
CREATE OR REPLACE FUNCTION cleanup_old_visitors()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM page_visitors
  WHERE last_seen < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Create a scheduled job to clean up old records every 5 minutes
SELECT cron.schedule(
  'cleanup-old-visitors',
  '*/5 * * * *',
  'SELECT cleanup_old_visitors()'
); 
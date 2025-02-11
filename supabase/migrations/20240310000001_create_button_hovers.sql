-- Create the button_hovers table
CREATE TABLE IF NOT EXISTS button_hovers (
  ip_address TEXT PRIMARY KEY,
  last_hover TIMESTAMP WITH TIME ZONE NOT NULL,
  hover_count INTEGER DEFAULT 1
);

-- Create an index on last_hover for faster queries
CREATE INDEX IF NOT EXISTS idx_button_hovers_last_hover ON button_hovers(last_hover);

-- Enable row level security
ALTER TABLE button_hovers ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to insert/update their own IP
CREATE POLICY "Allow anyone to insert/update their own hover"
  ON button_hovers
  FOR ALL
  USING (true)
  WITH CHECK (true); 
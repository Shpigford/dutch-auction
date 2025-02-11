-- Create sale_status table
CREATE TABLE IF NOT EXISTS sale_status (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_sold BOOLEAN NOT NULL DEFAULT FALSE,
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert initial record
INSERT INTO sale_status (is_sold) VALUES (FALSE);

-- Create function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_sale_status_updated_at
    BEFORE UPDATE ON sale_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE sale_status ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read sale status
CREATE POLICY "Allow anyone to read sale status" ON sale_status
    FOR SELECT
    TO public
    USING (true);

-- Only allow authenticated users to update sale status
CREATE POLICY "Only allow authenticated users to update sale status" ON sale_status
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true); 
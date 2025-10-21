-- Add missing columns to bluesky_quote_chains table
ALTER TABLE bluesky_quote_chains 
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create trigger to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bluesky_quote_chains_updated_at 
    BEFORE UPDATE ON bluesky_quote_chains
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

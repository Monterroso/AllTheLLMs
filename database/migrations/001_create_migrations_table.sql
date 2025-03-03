-- Migration: 001_create_migrations_table
-- Description: Creates the migrations table to track applied migrations

-- Create migrations table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  batch INTEGER NOT NULL
);

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS migrations_name_idx ON migrations (name);

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('001_create_migrations_table', 1); 
-- Migration: 003_create_servers_table
-- Description: Creates the servers table to store Discord server information

-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
  id SERIAL PRIMARY KEY,
  discord_server_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint on discord_server_id
CREATE UNIQUE INDEX IF NOT EXISTS servers_discord_server_id_idx ON servers (discord_server_id);

-- Add index for name for faster searches
CREATE INDEX IF NOT EXISTS servers_name_idx ON servers (name);

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('003_create_servers_table', 1); 
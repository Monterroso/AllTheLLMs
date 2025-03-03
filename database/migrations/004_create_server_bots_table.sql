-- Migration: 004_create_server_bots_table
-- Description: Creates the server_bots table to store relationships between servers and bots

-- Create server_bots table
CREATE TABLE IF NOT EXISTS server_bots (
  id SERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL,
  bot_id INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (bot_id) REFERENCES bot_configs(id) ON DELETE CASCADE
);

-- Add unique constraint to prevent duplicate relationships
CREATE UNIQUE INDEX IF NOT EXISTS server_bots_server_bot_idx ON server_bots (server_id, bot_id);

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS server_bots_server_id_idx ON server_bots (server_id);
CREATE INDEX IF NOT EXISTS server_bots_bot_id_idx ON server_bots (bot_id);

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('004_create_server_bots_table', 1); 
-- Migration: 002_create_bot_configs_table
-- Description: Creates the bot_configs table to store bot configuration data

-- Create bot_configs table
CREATE TABLE IF NOT EXISTS bot_configs (
  id SERIAL PRIMARY KEY,
  alias VARCHAR(255) NOT NULL,
  llm_type VARCHAR(100) NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  response_probability DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  system_prompt TEXT,
  respond_to_bots BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  message_history_count INTEGER NOT NULL DEFAULT 10
);

-- Add unique constraint on alias
CREATE UNIQUE INDEX IF NOT EXISTS bot_configs_alias_idx ON bot_configs (alias);

-- Add indexes for common query fields
CREATE INDEX IF NOT EXISTS bot_configs_llm_type_idx ON bot_configs (llm_type);

-- Insert this migration record
INSERT INTO migrations (name, batch) 
VALUES ('002_create_bot_configs_table', 1); 
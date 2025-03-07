-- Migration: Add stopped field to servers table
-- Description: Adds a boolean field to track if the bot should respond in a server

-- Up Migration
ALTER TABLE servers ADD COLUMN stopped BOOLEAN NOT NULL DEFAULT FALSE;
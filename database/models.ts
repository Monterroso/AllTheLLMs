/**
 * Database models for the bot
 * These types represent the structure of our Supabase tables
 */

// Bot configuration model
export interface BotConfig {
  id: number;
  alias: string;
  llm_type: string;
  encrypted_api_key: string;
  response_probability: number;
  system_prompt: string;
  respond_to_bots: boolean;
  avatar_url: string;
  created_at: string;
  message_history_count: number;
}

// Server model
export interface Server {
  id: number;
  discord_server_id: string;
  name: string;
  joined_at: string;
}

// Server-Bot relationship model
export interface ServerBot {
  id: number;
  server_id: number;
  bot_id: number;
}

// Migration model for tracking database migrations
export interface Migration {
  id: number;
  name: string;
  applied_at: string;
  batch: number;
}

// Database tables
export enum Tables {
  BOT_CONFIGS = 'bot_configs',
  SERVERS = 'servers',
  SERVER_BOTS = 'server_bots',
  MIGRATIONS = 'migrations',
} 
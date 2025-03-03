import supabase from '../database';
import type { BotConfig, Server, ServerBot } from '../database/models';
import { Tables } from '../database/models';
import { logger } from '../utils/logger';

/**
 * Database service for handling database operations
 * Provides methods for interacting with the bot_configs, servers, and server_bots tables
 */
export class DatabaseService {
  /**
   * Get all bot configurations
   * @returns Array of bot configurations
   */
  async getAllBotConfigs(): Promise<BotConfig[]> {
    const { data, error } = await supabase
      .from(Tables.BOT_CONFIGS)
      .select('*');
    
    if (error) {
      logger.error(`Error fetching bot configs: ${error.message}`);
      return [];
    }
    
    return data || [];
  }

  /**
   * Get a bot configuration by alias
   * @param alias The unique alias of the bot
   * @returns The bot configuration or null if not found
   */
  async getBotConfigByAlias(alias: string): Promise<BotConfig | null> {
    const { data, error } = await supabase
      .from(Tables.BOT_CONFIGS)
      .select('*')
      .eq('alias', alias)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error(`Error fetching bot config by alias: ${error.message}`);
      return null;
    }
    
    return data;
  }

  /**
   * Get all bot configurations enabled for a server
   * @param serverId The Discord server ID
   * @returns Array of bot configurations enabled for the server
   */
  async getServerBots(serverId: string): Promise<BotConfig[]> {
    // First get the server record
    const { data: serverData, error: serverError } = await supabase
      .from(Tables.SERVERS)
      .select('id')
      .eq('discord_server_id', serverId)
      .single();
    
    if (serverError) {
      logger.error(`Error fetching server: ${serverError.message}`);
      return [];
    }
    
    if (!serverData) {
      return [];
    }
    
    // Then get the bot configs for this server
    const { data, error } = await supabase
      .from(Tables.SERVER_BOTS)
      .select(`
        bot_id,
        bot:${Tables.BOT_CONFIGS}(*)
      `)
      .eq('server_id', serverData.id);
    
    if (error) {
      logger.error(`Error fetching server bots: ${error.message}`);
      return [];
    }
    
    // Extract the bot configs from the joined query
    if (!data) return [];
    
    const botConfigs: BotConfig[] = [];
    for (const item of data) {
      if (item.bot) {
        botConfigs.push(item.bot as unknown as BotConfig);
      }
    }
    
    return botConfigs;
  }

  /**
   * Enable a bot for a server
   * @param serverId The Discord server ID
   * @param alias The bot alias to enable
   * @returns True if successful, false otherwise
   */
  async enableBotForServer(serverId: string, alias: string): Promise<boolean> {
    // Get the bot config
    const botConfig = await this.getBotConfigByAlias(alias);
    if (!botConfig) {
      logger.error(`Bot with alias ${alias} not found`);
      return false;
    }
    
    // Get or create the server record
    let serverRecord = await this.getServerByDiscordId(serverId);
    
    if (!serverRecord) {
      // Create the server record
      const { data: newServer, error: createError } = await supabase
        .from(Tables.SERVERS)
        .insert({
          discord_server_id: serverId,
          name: 'Unknown', // This will be updated when we have the server name
          joined_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        logger.error(`Error creating server record: ${createError.message}`);
        return false;
      }
      
      serverRecord = newServer;
    }
    
    if (!serverRecord) {
      logger.error('Failed to create or retrieve server record');
      return false;
    }
    
    // Check if the bot is already enabled for this server
    const { data: existingRelation, error: relationError } = await supabase
      .from(Tables.SERVER_BOTS)
      .select('*')
      .eq('server_id', serverRecord.id)
      .eq('bot_id', botConfig.id)
      .single();
    
    if (relationError && relationError.code !== 'PGRST116') {
      logger.error(`Error checking existing relation: ${relationError.message}`);
      return false;
    }
    
    if (existingRelation) {
      // Bot is already enabled for this server
      return true;
    }
    
    // Create the relation
    const { error } = await supabase
      .from(Tables.SERVER_BOTS)
      .insert({
        server_id: serverRecord.id,
        bot_id: botConfig.id
      });
    
    if (error) {
      logger.error(`Error enabling bot for server: ${error.message}`);
      return false;
    }
    
    return true;
  }

  /**
   * Get a server by Discord ID
   * @param discordServerId The Discord server ID
   * @returns The server record or null if not found
   */
  async getServerByDiscordId(discordServerId: string): Promise<Server | null> {
    const { data, error } = await supabase
      .from(Tables.SERVERS)
      .select('*')
      .eq('discord_server_id', discordServerId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error(`Error fetching server by Discord ID: ${error.message}`);
      return null;
    }
    
    return data;
  }

  /**
   * Update server information
   * @param serverId The Discord server ID
   * @param name The server name
   * @returns True if successful, false otherwise
   */
  async updateServerInfo(serverId: string, name: string): Promise<boolean> {
    const server = await this.getServerByDiscordId(serverId);
    
    if (!server) {
      // Create the server record
      const { error } = await supabase
        .from(Tables.SERVERS)
        .insert({
          discord_server_id: serverId,
          name,
          joined_at: new Date().toISOString()
        });
      
      if (error) {
        logger.error(`Error creating server record: ${error.message}`);
        return false;
      }
    } else {
      // Update the server record
      const { error } = await supabase
        .from(Tables.SERVERS)
        .update({ name })
        .eq('id', server.id);
      
      if (error) {
        logger.error(`Error updating server record: ${error.message}`);
        return false;
      }
    }
    
    return true;
  }
} 
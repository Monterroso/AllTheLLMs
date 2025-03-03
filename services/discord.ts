import { 
  Client, 
  Guild, 
  Message, 
  TextChannel, 
  EmbedBuilder, 
  GuildMember,
  ChannelType
} from 'discord.js';
import { logger } from '../utils/logger';
import type { BotConfig } from '../database/models';
import { DatabaseService } from './database';
import { LLMService } from './llm';

/**
 * Service for handling Discord-specific operations
 * Manages bot personalities, message processing, and Discord interactions
 */
export class DiscordService {
  private client: Client;
  private databaseService: DatabaseService;
  private llmService: LLMService;
  private activeServers: Map<string, Set<string>> = new Map(); // Map of server ID to set of active bot aliases
  private serverMessageHistory: Map<string, Message[]> = new Map(); // Map of server ID to message history
  private stopResponding: Set<string> = new Set(); // Set of server IDs where the bot should not respond

  constructor(client: Client) {
    this.client = client;
    this.databaseService = new DatabaseService();
    this.llmService = new LLMService();
  }

  /**
   * Initialize the Discord service
   * This should be called when the client is ready
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Discord service...');
    
    // Update server information for all guilds the bot is in
    for (const guild of this.client.guilds.cache.values()) {
      await this.updateServerInfo(guild);
    }
    
    logger.success('Discord service initialized.');
  }

  /**
   * Update server information in the database
   * @param guild The Discord guild
   */
  async updateServerInfo(guild: Guild): Promise<void> {
    try {
      await this.databaseService.updateServerInfo(guild.id, guild.name);
      logger.info(`Updated server info for ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error(`Error updating server info for ${guild.name} (${guild.id}): ${error}`);
    }
  }

  /**
   * Enable a bot personality for a server
   * @param serverId The Discord server ID
   * @param alias The bot alias to enable
   * @returns True if successful, false otherwise
   */
  async enableBotForServer(serverId: string, alias: string): Promise<boolean> {
    try {
      const success = await this.databaseService.enableBotForServer(serverId, alias);
      
      if (success) {
        // Add to active servers map
        if (!this.activeServers.has(serverId)) {
          this.activeServers.set(serverId, new Set());
        }
        
        this.activeServers.get(serverId)?.add(alias);
        logger.info(`Enabled bot ${alias} for server ${serverId}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error enabling bot for server: ${error}`);
      return false;
    }
  }

  /**
   * Get all bot personalities enabled for a server
   * @param serverId The Discord server ID
   * @returns Array of bot configurations
   */
  async getServerBots(serverId: string): Promise<BotConfig[]> {
    try {
      return await this.databaseService.getServerBots(serverId);
    } catch (error) {
      logger.error(`Error getting server bots: ${error}`);
      return [];
    }
  }

  /**
   * Stop the bot from responding in a server
   * @param serverId The Discord server ID
   */
  stopRespondingInServer(serverId: string): void {
    this.stopResponding.add(serverId);
    logger.info(`Stopped responding in server ${serverId}`);
  }

  /**
   * Resume the bot responding in a server
   * @param serverId The Discord server ID
   */
  resumeRespondingInServer(serverId: string): void {
    this.stopResponding.delete(serverId);
    logger.info(`Resumed responding in server ${serverId}`);
  }

  /**
   * Process a message and generate a response if needed
   * @param message The Discord message
   */
  async processMessage(message: Message): Promise<void> {
    // Ignore messages from bots (unless configured otherwise)
    if (message.author.bot) return;
    
    // Ignore messages in DMs
    if (!message.guild) return;
    
    // Ignore messages if the bot is stopped in this server
    if (this.stopResponding.has(message.guild.id)) return;
    
    // Add message to history
    this.addMessageToHistory(message);
    
    // Check if the message contains a bot trigger
    const botAlias = this.extractBotAlias(message.content);
    if (botAlias) {
      await this.respondWithBot(message, botAlias);
      return;
    }
    
    // Check if we should respond randomly based on probability
    await this.checkRandomResponse(message);
  }

  /**
   * Extract a bot alias from a message content
   * @param content The message content
   * @returns The bot alias or null if not found
   */
  private extractBotAlias(content: string): string | null {
    const match = content.match(/!([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Add a message to the server's message history
   * @param message The Discord message
   */
  private addMessageToHistory(message: Message): void {
    if (!message.guild) return;
    
    const serverId = message.guild.id;
    
    if (!this.serverMessageHistory.has(serverId)) {
      this.serverMessageHistory.set(serverId, []);
    }
    
    const history = this.serverMessageHistory.get(serverId);
    if (history) {
      // Add the message to history
      history.push(message);
      
      // Limit history size (default to 100 messages per server)
      const maxHistorySize = 100;
      if (history.length > maxHistorySize) {
        history.shift(); // Remove oldest message
      }
    }
  }

  /**
   * Respond to a message with a specific bot personality
   * @param message The Discord message
   * @param alias The bot alias to respond with
   */
  private async respondWithBot(message: Message, alias: string): Promise<void> {
    if (!message.guild) return;
    
    try {
      // Get the bot configuration
      const botConfig = await this.databaseService.getBotConfigByAlias(alias);
      
      if (!botConfig) {
        logger.warn(`Bot with alias ${alias} not found`);
        return;
      }
      
      // Check if this bot is enabled for this server
      const serverBots = await this.databaseService.getServerBots(message.guild.id);
      const isEnabled = serverBots.some(bot => bot.alias === alias);
      
      if (!isEnabled) {
        logger.warn(`Bot ${alias} is not enabled for server ${message.guild.id}`);
        return;
      }
      
      // Get message history for context
      const history = this.getMessageHistoryForLLM(message, botConfig.message_history_count);
      
      // Generate response
      const response = await this.llmService.generateResponse(botConfig, history);
      
      // Send the response
      await this.sendBotResponse(message, response, botConfig);
      
    } catch (error) {
      logger.error(`Error responding with bot ${alias}: ${error}`);
    }
  }

  /**
   * Check if we should respond randomly based on probability
   * @param message The Discord message
   */
  private async checkRandomResponse(message: Message): Promise<void> {
    if (!message.guild) return;
    
    try {
      // Get all bots enabled for this server
      const serverBots = await this.databaseService.getServerBots(message.guild.id);
      
      // Filter bots that can respond randomly
      const eligibleBots = serverBots.filter(bot => bot.response_probability > 0);
      
      if (eligibleBots.length === 0) return;
      
      // Select a bot based on probability
      for (const bot of eligibleBots) {
        const random = Math.random();
        
        if (random < bot.response_probability) {
          // Get message history for context
          const history = this.getMessageHistoryForLLM(message, bot.message_history_count);
          
          // Generate response
          const response = await this.llmService.generateResponse(bot, history);
          
          // Send the response
          await this.sendBotResponse(message, response, bot);
          
          // Only one bot should respond randomly
          break;
        }
      }
    } catch (error) {
      logger.error(`Error checking random response: ${error}`);
    }
  }

  /**
   * Get message history formatted for LLM input
   * @param message The current message
   * @param count Number of previous messages to include
   * @returns Array of messages formatted for LLM input
   */
  private getMessageHistoryForLLM(
    message: Message, 
    count: number
  ): Array<{ role: string; content: string }> {
    if (!message.guild) return [];
    
    const serverId = message.guild.id;
    const history = this.serverMessageHistory.get(serverId) || [];
    
    // Get the last 'count' messages
    const recentMessages = history.slice(-count);
    
    // Format messages for LLM input
    return recentMessages.map(msg => ({
      role: msg.author.id === this.client.user?.id ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  /**
   * Send a bot response to a message
   * @param message The original message
   * @param response The response text
   * @param botConfig The bot configuration
   */
  private async sendBotResponse(
    message: Message, 
    response: string, 
    botConfig: BotConfig
  ): Promise<void> {
    if (!message.channel.isTextBased()) return;
    
    try {
      // Set the bot's avatar if provided
      if (botConfig.avatar_url && this.client.user) {
        try {
          await this.client.user.setAvatar(botConfig.avatar_url);
          logger.info(`Set avatar for bot ${botConfig.alias}`);
        } catch (error) {
          logger.warn(`Error setting avatar for bot ${botConfig.alias}: ${error}`);
          // Continue anyway, avatar change is not critical
        }
      }
      
      // Send the response
      await message.reply(response);
      
    } catch (error) {
      logger.error(`Error sending bot response: ${error}`);
    }
  }
} 
import { 
  Client, 
  Guild, 
  Message, 
  TextChannel, 
  EmbedBuilder, 
  GuildMember,
  ChannelType,
  WebhookClient
} from 'discord.js';
import { logger } from '@utils/logger';
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
  private stopResponding: Set<string> = new Set(); // Set of server IDs where the bot should not respond
  private webhookCache: Map<string, WebhookClient> = new Map(); // Cache of channel ID to webhook client

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
      const history = await this.getMessageHistoryForLLM(message, botConfig.message_history_count);
      
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
          const history = await this.getMessageHistoryForLLM(message, bot.message_history_count);
          
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
  private async getMessageHistoryForLLM(
    message: Message, 
    count: number
  ): Promise<Array<{ role: string; content: string }>> {
    if (!message.guild || !message.channel.isTextBased()) return [];
    
    try {
      // Fetch recent messages from the channel
      const fetchedMessages = await message.channel.messages.fetch({ 
        limit: count,
        before: message.id 
      });
      
      // Add the current message to the history
      const allMessages = [message, ...fetchedMessages.values()];
      
      // Sort messages by timestamp (oldest first)
      const sortedMessages = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      // Format messages for LLM input
      return sortedMessages.map(msg => ({
        role: msg.author.id === this.client.user?.id ? 'assistant' : 'user',
        content: msg.content
      }));
    } catch (error) {
      logger.error(`Error fetching message history: ${error}`);
      return [{
        role: 'user',
        content: message.content
      }];
    }
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
      // Use webhooks to send the message with custom username and avatar
      const webhook = await this.getOrCreateWebhook(message);
      
      if (webhook) {
        // Send message with custom username and avatar
        await webhook.send({
          content: response,
          username: botConfig.alias, // Use the bot alias as the username
          avatarURL: botConfig.avatar_url || undefined,
          // Reference the original message to create a reply
          threadId: message.channel.isThread() ? message.channel.id : undefined,
          // Make it appear as a reply to the original message
          allowedMentions: { repliedUser: true },
          // Include the original message reference
          flags: message.flags.bitfield
        });
        
        logger.info(`Sent response as ${botConfig.alias} using webhook`);
      } else {
        // Fallback to regular message reply if webhook creation fails
        logger.warn(`Could not create webhook, falling back to regular message`);
        await message.reply(response);
      }
    } catch (error) {
      logger.error(`Error sending bot response: ${error}`);
      
      // Attempt to fall back to regular message if webhook fails
      try {
        await message.reply(response);
      } catch (fallbackError) {
        logger.error(`Fallback reply also failed: ${fallbackError}`);
      }
    }
  }
  
  /**
   * Get an existing webhook or create a new one for the channel
   * @param message The message to respond to
   * @returns A webhook client or null if creation fails
   */
  private async getOrCreateWebhook(message: Message): Promise<WebhookClient | null> {
    if (!message.guild || !message.channel.isTextBased()) return null;
    
    const channelId = message.channel.id;
    
    // Check if we already have a webhook for this channel
    if (this.webhookCache.has(channelId)) {
      return this.webhookCache.get(channelId) || null;
    }
    
    try {
      // Try to find an existing webhook created by our bot
      const channel = message.channel as TextChannel;
      const webhooks = await channel.fetchWebhooks();
      let webhook = webhooks.find(wh => wh.owner?.id === this.client.user?.id);
      
      // Create a new webhook if none exists
      if (!webhook) {
        webhook = await channel.createWebhook({
          name: 'AllTheLLMs Bot',
          avatar: this.client.user?.displayAvatarURL(),
          reason: 'Created for AllTheLLMs bot personality responses'
        });
        
        logger.info(`Created new webhook in channel ${channel.name}`);
      }
      
      // Create a webhook client and cache it
      const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token || '' });
      this.webhookCache.set(channelId, webhookClient);
      
      return webhookClient;
    } catch (error) {
      logger.error(`Error creating webhook: ${error}`);
      return null;
    }
  }
} 
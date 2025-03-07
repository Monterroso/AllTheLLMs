import { 
  Client, 
  Guild, 
  Message, 
  TextChannel, 
  EmbedBuilder, 
  GuildMember,
  ChannelType,
  WebhookClient,
  BaseGuildTextChannel,
  DMChannel,
  ThreadChannel
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
  private typingChannels: Set<string> = new Set(); // Set of channel IDs where the bot is currently typing
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Map of channel ID to typing timeout
  private readonly MAX_MESSAGE_LENGTH = 2000; // Discord's maximum message length

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
  public async getServerBots(serverId: string): Promise<BotConfig[]> {
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
    // if (message.author.bot) return;
    
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
      
      // Start typing indicator
      await this.startTyping(message);
      
      try {
        // Get message history for context
        const history = await this.getMessageHistoryForLLM(message, botConfig.message_history_count);
        
        // Generate bot awareness message
        const botAwarenessMessage = await this.generateBotAwarenessMessage(message.guild.id, alias);
        
        // Generate response with bot awareness
        const response = await this.llmService.generateResponse(botConfig, history, botAwarenessMessage);
        
        // Send the response
        await this.sendBotResponse(message, response, botConfig);
      } finally {
        // Stop typing indicator regardless of success or failure
        this.stopTyping(message);
      }
      
    } catch (error) {
      logger.error(`Error responding with bot ${alias}: ${error}`);
      // Ensure typing is stopped even if there's an error
      this.stopTyping(message);
    }
  }

  /**
   * Check if we should respond randomly based on probability
   * @param message The Discord message
   */
  private async checkRandomResponse(message: Message): Promise<void> {
    if (!message.guild) return;
    
    // Skip random responses for messages from bots
    if (message.author.bot) return;
    
    try {
      // Get all bots enabled for this server
      const serverBots = await this.databaseService.getServerBots(message.guild.id);
      
      // Filter bots that can respond randomly
      const eligibleBots = serverBots.filter(bot => bot.response_probability > 0);
      
      if (eligibleBots.length === 0) return;
      
      // First, determine if any bot should respond at all
      // Find the highest probability to use as the threshold for responding
      const highestProbability = Math.max(...eligibleBots.map(bot => bot.response_probability));
      const shouldRespond = Math.random() < highestProbability;
      
      if (!shouldRespond) return;
      
      // Use weighted random selection to pick which bot responds
      // Create an array of weights based on each bot's probability
      const weights = eligibleBots.map(bot => bot.response_probability);
      const selectedBot = this.weightedRandomSelection(eligibleBots, weights);
      
      if (selectedBot) {
        // Use the existing respondWithBot method to handle the response
        await this.respondWithBot(message, selectedBot.alias);
      }
    } catch (error) {
      logger.error(`Error checking random response: ${error}`);
    }
  }

  /**
   * Select an item from an array using weighted random selection
   * @param items Array of items to select from
   * @param weights Array of weights corresponding to each item
   * @returns The selected item or null if the array is empty
   */
  private weightedRandomSelection<T>(items: T[], weights: number[]): T | null {
    if (items.length === 0 || weights.length === 0 || items.length !== weights.length) {
      return null;
    }
    
    // Calculate the sum of all weights
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Generate a random number between 0 and the total weight
    const randomValue = Math.random() * totalWeight;
    
    // Find the item that corresponds to the random value
    let cumulativeWeight = 0;
    for (let i = 0; i < items.length; i++) {
      cumulativeWeight += weights[i];
      if (randomValue < cumulativeWeight) {
        return items[i];
      }
    }
    
    // Fallback to the last item (should rarely happen due to floating-point precision)
    return items[items.length - 1];
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
        // Split the response if it exceeds Discord's character limit
        const messageParts = this.splitLongMessage(response);
        
        // Send each part as a separate message
        for (let i = 0; i < messageParts.length; i++) {
          const isFirstMessage = i === 0;
          
          // Prepare webhook options
          const webhookOptions: any = {
            content: messageParts[i],
            username: botConfig.alias, // Use the bot alias as the username
            avatarURL: botConfig.avatar_url || undefined,
            // Only make the first message appear as a reply to the original message
            allowedMentions: isFirstMessage ? { repliedUser: true } : undefined,
          };
          
          // Handle thread messages properly
          if (message.channel.isThread()) {
            // For threads, we need to specify the thread ID
            webhookOptions.threadId = message.channel.id;
          }
          
          await webhook.send(webhookOptions);
          
          // Add a small delay between messages to maintain order
          if (i < messageParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        logger.info(`Sent response as ${botConfig.alias} using webhook (${messageParts.length} parts)`);
      } else {
        // Fallback to regular message reply if webhook creation fails
        logger.warn(`Could not create webhook, falling back to regular message`);
        
        // Split the response if it exceeds Discord's character limit
        const messageParts = this.splitLongMessage(response);
        
        // Send the first part as a reply to the original message
        const firstReply = await message.reply(messageParts[0]);
        
        // Send the rest as regular messages
        for (let i = 1; i < messageParts.length; i++) {
          // Use the correct method to send messages to the channel
          const channel = message.channel;
          if (channel instanceof BaseGuildTextChannel || 
              channel instanceof DMChannel || 
              channel instanceof ThreadChannel) {
            await channel.send(messageParts[i]);
          }
          
          // Add a small delay between messages to maintain order
          if (i < messageParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } catch (error) {
      logger.error(`Error sending bot response: ${error}`);
      
      // Attempt to fall back to regular message if webhook fails
      try {
        // Split the response if it exceeds Discord's character limit
        const messageParts = this.splitLongMessage(response);
        
        // Send the first part as a reply to the original message
        const firstReply = await message.reply(messageParts[0]);
        
        // Send the rest as regular messages
        for (let i = 1; i < messageParts.length; i++) {
          // Use the correct method to send messages to the channel
          const channel = message.channel;
          if (channel instanceof BaseGuildTextChannel || 
              channel instanceof DMChannel || 
              channel instanceof ThreadChannel) {
            await channel.send(messageParts[i]);
          }
        }
      } catch (fallbackError) {
        logger.error(`Fallback reply also failed: ${fallbackError}`);
      }
    }
  }
  
  /**
   * Split a long message into multiple parts that fit within Discord's character limit
   * @param message The message to split
   * @returns An array of message parts
   */
  private splitLongMessage(message: string): string[] {
    // If the message is within the limit, return it as is
    if (message.length <= this.MAX_MESSAGE_LENGTH) {
      return [message];
    }
    
    const parts: string[] = [];
    let remainingText = message;
    
    while (remainingText.length > 0) {
      // If the remaining text fits within the limit
      if (remainingText.length <= this.MAX_MESSAGE_LENGTH) {
        parts.push(remainingText);
        break;
      }
      
      // Find a good breaking point (preferably at a paragraph or sentence)
      let splitIndex = this.MAX_MESSAGE_LENGTH;
      
      // Try to find a paragraph break within the last 200 characters of the limit
      const lastParagraphBreak = remainingText.lastIndexOf('\n\n', this.MAX_MESSAGE_LENGTH);
      if (lastParagraphBreak > this.MAX_MESSAGE_LENGTH - 200) {
        splitIndex = lastParagraphBreak + 2; // Include the paragraph break
      } else {
        // Try to find a line break
        const lastLineBreak = remainingText.lastIndexOf('\n', this.MAX_MESSAGE_LENGTH);
        if (lastLineBreak > this.MAX_MESSAGE_LENGTH - 100) {
          splitIndex = lastLineBreak + 1; // Include the line break
        } else {
          // Try to find a sentence break (period, question mark, exclamation mark)
          const sentenceBreakRegex = /[.!?]\s/g;
          let lastSentenceBreak = -1;
          let match;
          
          // Find the last sentence break within the limit
          while ((match = sentenceBreakRegex.exec(remainingText.substring(0, this.MAX_MESSAGE_LENGTH))) !== null) {
            lastSentenceBreak = match.index + 2; // Include the punctuation and space
          }
          
          if (lastSentenceBreak > this.MAX_MESSAGE_LENGTH - 100) {
            splitIndex = lastSentenceBreak;
          } else {
            // If no good breaking point is found, try to break at a space
            const lastSpace = remainingText.lastIndexOf(' ', this.MAX_MESSAGE_LENGTH);
            if (lastSpace > this.MAX_MESSAGE_LENGTH - 50) {
              splitIndex = lastSpace + 1; // Include the space
            }
            // Otherwise, just break at the maximum length
          }
        }
      }
      
      // Add the part and update the remaining text
      parts.push(remainingText.substring(0, splitIndex));
      remainingText = remainingText.substring(splitIndex);
    }
    
    return parts;
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
      let targetChannel: TextChannel;
      
      // Handle threads by getting their parent channel
      if (message.channel.isThread()) {
        // Get the parent channel of the thread
        const parentChannel = message.channel.parent;
        
        // If we can't get the parent channel or it's not a text channel, we can't create a webhook
        if (!parentChannel || !(parentChannel instanceof TextChannel)) {
          logger.error(`Cannot create webhook: Thread's parent channel is not available or not a text channel`);
          return null;
        }
        
        targetChannel = parentChannel;
        logger.debug(`Using parent channel ${parentChannel.name} for thread webhook`);
      } else if (message.channel instanceof TextChannel) {
        // For regular text channels
        targetChannel = message.channel;
      } else {
        // For other channel types that don't support webhooks
        logger.error(`Channel type ${message.channel.type} does not support webhooks`);
        return null;
      }
      
      // Try to find an existing webhook created by our bot
      const webhooks = await targetChannel.fetchWebhooks();
      let webhook = webhooks.find(wh => wh.owner?.id === this.client.user?.id);
      
      // Create a new webhook if none exists
      if (!webhook) {
        webhook = await targetChannel.createWebhook({
          name: 'AllTheLLMs Bot',
          avatar: this.client.user?.displayAvatarURL(),
          reason: 'Created for AllTheLLMs bot personality responses'
        });
        
        logger.info(`Created new webhook in channel ${targetChannel.name}`);
      }
      
      // Create a webhook client and cache it
      const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token || '' });
      
      // Cache the webhook using the original channel ID (which might be a thread)
      // This way, future messages in the same thread will reuse this webhook
      this.webhookCache.set(channelId, webhookClient);
      
      return webhookClient;
    } catch (error) {
      logger.error(`Error creating webhook: ${error}`);
      return null;
    }
  }

  /**
   * Start the typing indicator in a channel
   * @param message The message to respond to
   */
  private async startTyping(message: Message): Promise<void> {
    if (!message.channel.isTextBased()) return;
    
    try {
      // Start typing indicator using the Discord.js API
      // Check if the channel supports typing indicators
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      // Add channel to typing set
      this.typingChannels.add(message.channel.id);
      
      // Set up a typing interval to keep the indicator active during long LLM generations
      this.maintainTypingIndicator(message.channel.id);
      
      logger.debug(`Started typing indicator in channel ${message.channel.id}`);
    } catch (error) {
      logger.error(`Error starting typing indicator: ${error}`);
    }
  }

  /**
   * Stop the typing indicator in a channel
   * @param message The message that was responded to
   */
  private stopTyping(message: Message): void {
    if (!message.channel.isTextBased()) return;
    
    // Remove channel from typing set
    this.typingChannels.delete(message.channel.id);
    
    // Clear any existing typing timeout
    const existingTimeout = this.typingTimeouts.get(message.channel.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeouts.delete(message.channel.id);
    }
    logger.debug(`Stopped typing indicator in channel ${message.channel.id}`);
  }

  /**
   * Maintain the typing indicator for long-running LLM generations
   * Discord's typing indicator only lasts about 10 seconds, so we need to refresh it
   * @param channelId The ID of the channel to maintain typing in
   */
  private maintainTypingIndicator(channelId: string): void {
    // Discord typing indicator lasts ~10 seconds, so refresh every 8 seconds
    const typingInterval = 8000;
    
    // Clear any existing timeout for this channel
    const existingTimeout = this.typingTimeouts.get(channelId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const sendTyping = async () => {
      // Check if we should still be typing in this channel
      if (!this.typingChannels.has(channelId)) {
        // Clean up the timeout if we're no longer typing
        this.typingTimeouts.delete(channelId);
        return;
      }
      
      try {
        const channel = await this.client.channels.fetch(channelId);
        // Check if the channel exists, is text-based, and supports typing indicators
        if (channel?.isTextBased() && 'sendTyping' in channel) {
          await channel.sendTyping();
          
          // Schedule next typing indicator if still needed
          const timeout = setTimeout(sendTyping, typingInterval);
          this.typingTimeouts.set(channelId, timeout);
        } else {
          // Channel no longer valid, clean up
          this.typingChannels.delete(channelId);
          this.typingTimeouts.delete(channelId);
        }
      } catch (error) {
        logger.error(`Error maintaining typing indicator: ${error}`);
        this.typingChannels.delete(channelId);
        this.typingTimeouts.delete(channelId);
      }
    };
    
    // Start the typing maintenance loop
    const timeout = setTimeout(sendTyping, typingInterval);
    this.typingTimeouts.set(channelId, timeout);
  }

  /**
   * Generate a bot awareness message for a server
   * @param serverId The Discord server ID
   * @param currentBotAlias The alias of the current bot
   * @returns The generated bot awareness message
   */
  private async generateBotAwarenessMessage(serverId: string, currentBotAlias: string): Promise<string> {
    try {
      // Get all bots enabled for this server
      const serverBots = await this.databaseService.getServerBots(serverId);
      
      // Filter out the current bot
      const otherBots = serverBots.filter(bot => bot.alias !== currentBotAlias);
      
      if (otherBots.length === 0) {
        return ""; // No other bots available
      }
      
      // Format the bot awareness message
      let message = "You can interact with other AI assistants in this server:\n";
      
      otherBots.forEach(bot => {
        message += `- !${bot.alias} (${bot.llm_type}): ${bot.system_prompt.substring(0, 100)}${bot.system_prompt.length > 100 ? '...' : ''}\n`;
      });
      
      message += "\nYou can message these assistants by using the !<alias> format in your responses. " +
                "Feel free to collaborate with them as an AI agent. " +
                "When another assistant messages you, respond to them as you would to a human user. If they should respond to you, you MUST use the !<alias> format." +
                "Remember that for a bot to respond to you, they must be mentioned in the message with the !<alias> format.";

      message += "\nIMPORTANT EXAMPLES for addressing bots with personas:\n" +
                "- CORRECT: If !Claude says 'I'm taking the role of Aristotle', you should respond with '!Claude, I have a question for you as Aristotle...'\n" +
                "- INCORRECT: '!Aristotle, I have a question for you...'\n" +
                "Always use the bot's actual alias (!Claude) not their persona name (!Aristotle) when addressing them.";

      return message;
    } catch (error) {
      logger.error(`Error generating bot awareness message: ${error}`);
      return ""; // Return empty string on error
    }
  }
} 
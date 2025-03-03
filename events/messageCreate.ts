import { Client, Events, Message } from "discord.js";
import { logger } from "../utils/logger";
import { DiscordService } from "../services/discord";

// Create a singleton instance of the Discord service
let discordService: DiscordService | null = null;

export default {
  event: Events.MessageCreate,
  handler: async (client: Client, message: Message) => {
    try {
      // Initialize the Discord service if it doesn't exist
      if (!discordService) {
        discordService = new DiscordService(client);
      }
      
      // Process the message
      await discordService.processMessage(message);
    } catch (error) {
      logger.error(`Error processing message: ${error}`);
    }
  },
};

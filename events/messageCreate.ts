import { Client, Events, Message } from "discord.js";
import { logger } from "../utils/logger";
import { getDiscordService } from "../services";

export default {
  event: Events.MessageCreate,
  handler: async (client: Client, message: Message) => {
    try {
      // Get the Discord service instance
      const discordService = getDiscordService(client);
      
      // Process the message
      await discordService.processMessage(message);
    } catch (error) {
      logger.error(`Error processing message: ${error}`);
    }
  },
};

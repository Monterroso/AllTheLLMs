import { ActivityType, Client, Events } from "discord.js";
import { logger } from "../utils/logger";
import { DiscordService } from "../services/discord";

// Create a singleton instance of the Discord service
let discordService: DiscordService | null = null;

export default {
  event: Events.ClientReady,
  handler: async (client: Client) => {
    try {
      if (!client.user) {
        logger.error("Client user is not set.");
        return;
      }
      
      logger.info("Setting presence...");

      client.user.setPresence({
        activities: [
          {
            name: "Multiple LLMs",
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore Discord.js does not have this property, but it is valid
            state: "Use !<alias> to chat with me",
            type: ActivityType.Custom,
          },
        ],
        status: "online",
      });
      
      logger.success("Presence set.");
      
      // Initialize the Discord service
      logger.info("Initializing Discord service...");
      discordService = new DiscordService(client);
      await discordService.initialize();
      logger.success("Discord service initialized.");
      
    } catch (err) {
      logger.error("Error in ready event:", err);
    }
  },
};

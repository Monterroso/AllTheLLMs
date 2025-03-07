import { ActivityType, Client, Events } from "discord.js";
import { logger } from "../utils/logger";
import { initializeServices } from "../services";

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
      
      // Initialize all services
      await initializeServices(client);
      
    } catch (err) {
      logger.error("Error in ready event:", err);
    }
  },
};

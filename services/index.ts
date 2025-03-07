import { Client } from 'discord.js';
import { DiscordService } from './discord';
import { logger } from '../utils/logger';

// Singleton instances of services
let discordService: DiscordService | null = null;

/**
 * Get the Discord service instance
 * Creates a new instance if one doesn't exist
 * @param client The Discord client
 * @returns The Discord service instance
 */
export function getDiscordService(client: Client): DiscordService {
  if (!discordService) {
    logger.info('Creating new Discord service instance');
    discordService = new DiscordService(client);
  }
  
  return discordService;
}

/**
 * Initialize all services
 * @param client The Discord client
 */
export async function initializeServices(client: Client): Promise<void> {
  logger.info('Initializing services...');
  
  // Get the Discord service and initialize it
  const discord = getDiscordService(client);
  await discord.initialize();
  
  logger.success('All services initialized');
} 
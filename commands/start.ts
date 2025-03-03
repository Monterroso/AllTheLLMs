import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { logger } from '../utils/logger';
import { DiscordService } from '../services/discord';
import client from '../clients/discord';

/**
 * Start command to resume the bot responding to messages
 * Usage: /start
 * Requires MANAGE_GUILD permission
 */
export default {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Resume the bot responding to messages in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      // Get the server ID
      const serverId = interaction.guildId;
      
      if (!serverId) {
        await interaction.reply('This command can only be used in a server.');
        return;
      }
      
      // Create Discord service
      const discordService = new DiscordService(client);
      
      // Resume responding in this server
      discordService.resumeRespondingInServer(serverId);
      
      await interaction.reply('✅ The bot will now respond to messages in this server.');
      
    } catch (error) {
      logger.error(`Error executing start command: ${error}`);
      await interaction.reply('An error occurred while executing this command.');
    }
  },
}; 
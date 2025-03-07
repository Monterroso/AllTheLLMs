import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { logger } from '../utils/logger';
import { getDiscordService } from '../services';
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
  
  async execute(data: { interaction: ChatInputCommandInteraction }) {
    const interaction = data.interaction;
    
    try {
      // Get the server ID
      const serverId = interaction.guildId;
      
      if (!serverId) {
        await interaction.reply('This command can only be used in a server.');
        return;
      }
      
      // Get the Discord service
      const discordService = getDiscordService(client);
      
      // Resume responding in this server
      const success = await discordService.resumeRespondingInServer(serverId);
      
      if (success) {
        await interaction.reply('✅ The bot will now respond to messages in this server.');
      } else {
        await interaction.reply('❌ Failed to start the bot. Please try again later.');
      }
      
    } catch (error) {
      logger.error(`Error executing start command: ${error}`);
      await interaction.reply('An error occurred while executing this command.');
    }
  },
}; 
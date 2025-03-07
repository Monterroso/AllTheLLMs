import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { logger } from '../utils/logger';
import { getDiscordService } from '../services';
import client from '../clients/discord';

/**
 * Stop command to prevent the bot from responding to messages
 * Usage: /stop
 * Requires MANAGE_GUILD permission
 */
export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the bot from responding to messages in this server')
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
      
      // Stop responding in this server
      const success = await discordService.stopRespondingInServer(serverId);
      
      if (success) {
        await interaction.reply('✅ The bot will no longer respond to messages in this server. Use `/start` to resume.');
      } else {
        await interaction.reply('❌ Failed to stop the bot. Please try again later.');
      }
      
    } catch (error) {
      logger.error(`Error executing stop command: ${error}`);
      await interaction.reply('An error occurred while executing this command.');
    }
  },
}; 
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { logger } from '../utils/logger';
import { DiscordService } from '../services/discord';
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
      
      // Create Discord service
      const discordService = new DiscordService(client);
      
      // Stop responding in this server
      discordService.stopRespondingInServer(serverId);
      
      await interaction.reply('✅ The bot will no longer respond to messages in this server. Use `/start` to resume.');
      
    } catch (error) {
      logger.error(`Error executing stop command: ${error}`);
      await interaction.reply('An error occurred while executing this command.');
    }
  },
}; 
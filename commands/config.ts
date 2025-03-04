import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { logger } from '../utils/logger';
import { DiscordService } from '../services/discord';
import client from '../clients/discord';

/**
 * Config command to enable a bot personality for a server
 * Usage: /config <alias>
 * Requires MANAGE_GUILD permission
 */
export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Enable a bot personality for this server')
    .addStringOption(option => 
      option
        .setName('alias')
        .setDescription('The alias of the bot personality to enable')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(data: { interaction: ChatInputCommandInteraction }) {
    const interaction = data.interaction;
    
    try {
      // Defer reply to give us time to process
      await interaction.deferReply();
      
      // Get the alias from the command options
      const alias = interaction.options.getString('alias');
      
      if (!alias) {
        await interaction.editReply('Please provide a valid bot alias.');
        return;
      }
      
      // Get the server ID
      const serverId = interaction.guildId;
      
      if (!serverId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }
      
      // Create Discord service
      const discordService = new DiscordService(client);
      
      // Enable the bot for this server
      const success = await discordService.enableBotForServer(serverId, alias);
      
      if (success) {
        await interaction.editReply(`✅ Bot personality "${alias}" has been enabled for this server.`);
      } else {
        await interaction.editReply(`❌ Failed to enable bot personality "${alias}". It may not exist or there was an error.`);
      }
    } catch (error) {
      logger.error(`Error executing config command: ${error}`);
      await interaction.editReply('An error occurred while executing this command.');
    }
  },
}; 
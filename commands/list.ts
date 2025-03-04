import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
} from 'discord.js';
import { logger } from '../utils/logger';
import { DiscordService } from '../services/discord';
import client from '../clients/discord';

/**
 * List command to display all bot personalities enabled for a server
 * Usage: /list
 */
export default {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all bot personalities enabled for this server'),
  
  async execute(data: { interaction: ChatInputCommandInteraction }) {
    const interaction = data.interaction;
    
    try {
      // Defer reply to give us time to process
      await interaction.deferReply();
      
      // Get the server ID
      const serverId = interaction.guildId;
      
      if (!serverId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }
      
      // Create Discord service
      const discordService = new DiscordService(client);
      
      // Get all bots enabled for this server
      const bots = await discordService.getServerBots(serverId);
      
      if (bots.length === 0) {
        await interaction.editReply('No bot personalities are currently enabled for this server. Use `/config <alias>` to enable one.');
        return;
      }
      
      // Create an embed to display the bots
      const embed = new EmbedBuilder()
        .setTitle('Enabled Bot Personalities')
        .setDescription('These are the bot personalities currently enabled for this server:')
        .setColor('#00FF00')
        .setTimestamp();
      
      // Add each bot to the embed
      bots.forEach(bot => {
        embed.addFields({
          name: `!${bot.alias} (${bot.llm_type})`,
          value: `${bot.system_prompt.substring(0, 100)}${bot.system_prompt.length > 100 ? '...' : ''}`,
          inline: false
        });
      });
      
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      logger.error(`Error executing list command: ${error}`);
      await interaction.editReply('An error occurred while executing this command.');
    }
  },
}; 
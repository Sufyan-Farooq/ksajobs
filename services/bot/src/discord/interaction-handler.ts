import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { prisma } from '@ksajobs/database';
import type { WhatsAppBroadcaster } from '../whatsapp/whatsapp.service.js';
import type { DiscordModerationBot } from './discord.bot.js';
import {
  buildApprovedEmbed,
  buildRejectedEmbed,
} from './embed-builder.js';
import { logger } from '../scrapers/base.scraper.js';

export async function handleDiscordButton(
  interaction: ButtonInteraction,
  bot: DiscordModerationBot,
  whatsAppService?: WhatsAppBroadcaster
): Promise<void> {
  const customId = interaction.customId;
  const userTag = interaction.user.tag;

  if (customId.startsWith('approve_')) {
    const jobId = customId.replace('approve_', '');
    await interaction.deferUpdate();

    try {
      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'APPROVED',
          approvedBy: userTag,
          approvedAt: new Date(),
        },
      });

      // Update Discord message UI
      const originalEmbed = interaction.message.embeds[0];
      const approvedEmbed = buildApprovedEmbed(originalEmbed, userTag);

      await interaction.editReply({
        embeds: [approvedEmbed],
        components: [],
      });

      logger.info({ jobId, approvedBy: userTag }, 'Job approved by moderator via Discord');

      // Broadcast to WhatsApp Groups & Channels
      if (whatsAppService && updated.whatsappMessageText) {
        await whatsAppService.broadcastJob(
          updated.id,
          updated.whatsappMessageText,
          updated.cityEn,
          updated.category
        );
      }
    } catch (err: any) {
      logger.error({ error: err.message, jobId }, 'Failed to approve job from Discord');
    }
  } else if (customId.startsWith('reject_')) {
    const jobId = customId.replace('reject_', '');

    // Show rejection modal for custom reason
    const modal = new ModalBuilder()
      .setCustomId(`reject_modal_${jobId}`)
      .setTitle('Reject Job Posting');

    const reasonInput = new TextInputBuilder()
      .setCustomId('rejection_reason')
      .setLabel('Reason for rejection')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g. Incomplete details, duplicate post, expired listing...')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }
}

export async function handleDiscordModal(
  interaction: ModalSubmitInteraction,
  _whatsAppService?: WhatsAppBroadcaster
): Promise<void> {
  const customId = interaction.customId;
  const userTag = interaction.user.tag;

  if (customId.startsWith('reject_modal_')) {
    const jobId = customId.replace('reject_modal_', '');
    const reason = interaction.fields.getTextInputValue('rejection_reason');

    await interaction.deferUpdate();

    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
        },
      });

      if (interaction.message) {
        const originalEmbed = interaction.message.embeds[0];
        const rejectedEmbed = buildRejectedEmbed(originalEmbed, userTag, reason);

        await interaction.editReply({
          embeds: [rejectedEmbed],
          components: [],
        });
      }

      logger.info({ jobId, rejectedBy: userTag, reason }, 'Job rejected by moderator via Discord');
    } catch (err: any) {
      logger.error({ error: err.message, jobId }, 'Failed to reject job from Discord modal');
    }
  }
}

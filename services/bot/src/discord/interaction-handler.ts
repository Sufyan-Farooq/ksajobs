import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { jobRepository, prisma } from '@ksajobs/database';
import { buildApprovedEmbed, buildRejectedEmbed } from './embed-builder.js';
import { logger } from '../scrapers/base.scraper.js';
import type { WhatsAppBroadcaster } from '../whatsapp/whatsapp.service.js';
import type { DiscordModerationBot } from './discord.bot.js';

export async function handleDiscordButton(
  interaction: ButtonInteraction,
  bot: DiscordModerationBot,
  whatsAppService?: WhatsAppBroadcaster
) {
  const [action, jobId] = interaction.customId.split(':');
  const userTag = interaction.user.tag;

  if (!jobId) return;

  try {
    if (action === 'approve_job') {
      await interaction.deferUpdate();

      // 1. Update status in Database
      const updatedJob = await jobRepository.approveJob(jobId, userTag);

      // 2. Broadcast to WhatsApp Groups
      if (whatsAppService && updatedJob.whatsappMessageText) {
        whatsAppService.enqueueBroadcast(
          updatedJob.id,
          updatedJob.whatsappMessageText,
          updatedJob.cityEn,
          updatedJob.category
        );
      }

      // 3. Update Discord message UI
      const originalEmbed = interaction.message.embeds[0];
      const approvedEmbed = buildApprovedEmbed(originalEmbed, userTag);

      await interaction.editReply({
        embeds: [approvedEmbed],
        components: [],
      });

      // 4. Forward to #approved channel & general logs
      await bot.postApprovedFeed(approvedEmbed);
      await bot.logToGeneral(`✅ **Job Approved**: \`${updatedJob.titleAr || updatedJob.titleEn}\` by **${userTag}**.`);

      logger.info({ jobId, approvedBy: userTag }, 'Job approved and enqueued for WhatsApp broadcast');
    } else if (action === 'reject_job') {
      await interaction.deferUpdate();

      // 1. Update status in Database
      const updatedJob = await jobRepository.rejectJob(jobId, `Rejected by moderator ${userTag}`);

      // 2. Update Discord message UI
      const originalEmbed = interaction.message.embeds[0];
      const rejectedEmbed = buildRejectedEmbed(originalEmbed, userTag);

      await interaction.editReply({
        embeds: [rejectedEmbed],
        components: [],
      });

      // 3. Forward to #rejected channel
      await bot.postRejectedFeed(rejectedEmbed);
      await bot.logToGeneral(`❌ **Job Rejected**: \`${updatedJob.titleAr || updatedJob.titleEn}\` by **${userTag}**.`);

      logger.info({ jobId, rejectedBy: userTag }, 'Job rejected by moderator');
    } else if (action === 'edit_job') {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        await interaction.reply({ content: 'Job not found in database.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_job:${jobId}`)
        .setTitle('Edit Job Details before Approval');

      const titleInput = new TextInputBuilder()
        .setCustomId('job_title')
        .setLabel('Job Title')
        .setStyle(TextInputStyle.Short)
        .setValue(job.titleEn || '')
        .setRequired(true);

      const cityInput = new TextInputBuilder()
        .setCustomId('job_city')
        .setLabel('City (English / Arabic)')
        .setStyle(TextInputStyle.Short)
        .setValue(`${job.cityEn} / ${job.cityAr || ''}`)
        .setRequired(true);

      const whatsappInput = new TextInputBuilder()
        .setCustomId('job_whatsapp')
        .setLabel('WhatsApp Message Text')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(job.whatsappMessageText.slice(0, 3900))
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(cityInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(whatsappInput)
      );

      await interaction.showModal(modal);
    }
  } catch (err: any) {
    logger.error({ error: err.message, customId: interaction.customId }, 'Error handling Discord interaction');
    await bot.logToError(`⚠️ Error handling button click \`${interaction.customId}\`: ${err.message}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `Action failed: ${err.message}`, ephemeral: true });
    }
  }
}

export async function handleDiscordModal(
  interaction: ModalSubmitInteraction,
  whatsAppService?: WhatsAppBroadcaster
) {
  const [action, jobId] = interaction.customId.split(':');
  if (action !== 'modal_edit_job' || !jobId) return;

  try {
    await interaction.deferUpdate();

    const titleEn = interaction.fields.getTextInputValue('job_title');
    const whatsappMessageText = interaction.fields.getTextInputValue('job_whatsapp');

    await prisma.job.update({
      where: { id: jobId },
      data: {
        titleEn,
        whatsappMessageText,
      },
    });

    logger.info({ jobId, editedBy: interaction.user.tag }, 'Job details updated via Discord modal');
  } catch (err: any) {
    logger.error({ error: err.message }, 'Error handling modal submit');
  }
}

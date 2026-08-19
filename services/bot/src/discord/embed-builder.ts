import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { ParsedJobData, RawScrapedJob } from '@ksajobs/types';

export function buildJobApprovalEmbed(jobId: string, parsed: ParsedJobData, raw: RawScrapedJob) {
  // Select color based on Saudization
  let color = 0x3b82f6; // Blue default
  if (parsed.saudization === 'SAUDI_ONLY') {
    color = 0x10b981; // Green for Saudi only
  } else if (parsed.saudization === 'EXPATS_ALLOWED') {
    color = 0x8b5cf6; // Purple for Expats allowed
  }

  const salaryDisplay =
    parsed.salaryMin && parsed.salaryMax
      ? `${parsed.salaryMin.toLocaleString()} - ${parsed.salaryMax.toLocaleString()} SAR`
      : 'Not Specified';

  const embed = new EmbedBuilder()
    .setTitle(`📋 [PENDING REVIEW] ${parsed.titleEn || raw.title}`)
    .setURL(raw.applyUrl)
    .setColor(color)
    .addFields(
      { name: '🏢 Company', value: parsed.companyName || raw.companyName, inline: true },
      { name: '📍 City / Location', value: `${parsed.cityAr} (${parsed.cityEn})`, inline: true },
      { name: '🇸🇦 Saudization Status', value: parsed.saudizationLabelAr || parsed.saudization, inline: true },
      { name: '💼 Work Type / Category', value: `${parsed.workType} • ${parsed.category}`, inline: true },
      { name: '💰 Salary', value: salaryDisplay, inline: true },
      { name: '🌐 Source Platform', value: `\`${raw.sourcePlatform.toUpperCase()}\``, inline: true },
      {
        name: '📱 WhatsApp Message Preview (To be sent on approval)',
        value: `\`\`\`text\n${parsed.whatsappMessageText.slice(0, 1000)}\n\`\`\``,
        inline: false,
      }
    )
    .setFooter({ text: `Job ID: ${jobId} • Scraped via KSAJobs Bot` })
    .setTimestamp();

  if (raw.companyLogo) {
    embed.setThumbnail(raw.companyLogo);
  }

  // Interactive Action Row Buttons
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_job:${jobId}`)
      .setLabel('✅ Approve & Broadcast')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`edit_job:${jobId}`)
      .setLabel('✏️ Quick Edit')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`reject_job:${jobId}`)
      .setLabel('❌ Reject')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel('🔗 View Original')
      .setStyle(ButtonStyle.Link)
      .setURL(raw.applyUrl)
  );

  return { embed, row };
}

export function buildApprovedEmbed(originalEmbed: any, moderatorTag: string) {
  const embed = EmbedBuilder.from(originalEmbed)
    .setTitle(originalEmbed.title.replace('[PENDING REVIEW]', '✅ [APPROVED & BROADCASTED]'))
    .setColor(0x10b981) // Green
    .addFields({
      name: '🛡️ Moderation Status',
      value: `Approved by **${moderatorTag}** on <t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: false,
    });

  return embed;
}

export function buildRejectedEmbed(originalEmbed: any, moderatorTag: string, reason?: string) {
  const embed = EmbedBuilder.from(originalEmbed)
    .setTitle(originalEmbed.title.replace('[PENDING REVIEW]', '❌ [REJECTED]'))
    .setColor(0xef4444) // Red
    .addFields({
      name: '🛡️ Moderation Status',
      value: `Rejected by **${moderatorTag}** ${reason ? `(Reason: ${reason})` : ''}`,
      inline: false,
    });

  return embed;
}

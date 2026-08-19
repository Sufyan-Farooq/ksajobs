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

  const fullWhatsAppText = parsed.whatsappMessageText || '';

  // Use Description for the full WhatsApp post (Discord allows up to 4096 chars in Description)
  const embed = new EmbedBuilder()
    .setTitle(`📋 [PENDING REVIEW] ${parsed.titleEn || raw.title}`)
    .setURL(raw.applyUrl)
    .setColor(color)
    .setDescription(
      fullWhatsAppText.length > 4000
        ? `${fullWhatsAppText.slice(0, 3950)}\n\n*(...Message truncated at 4,000 characters for Discord)*`
        : fullWhatsAppText
    )
    .addFields(
      { name: '🏢 Company', value: parsed.companyName || raw.companyName || 'N/A', inline: true },
      { name: '📍 Location', value: `${parsed.cityAr || ''} (${parsed.cityEn || 'Saudi Arabia'})`, inline: true },
      { name: '🇸🇦 Saudization', value: parsed.saudizationLabelAr || parsed.saudization || 'Open', inline: true },
      { name: '💼 Work Type / Sector', value: `${parsed.workType} • ${parsed.category}`, inline: true },
      { name: '💰 Salary', value: salaryDisplay, inline: true },
      { name: '🌐 Source Platform', value: `\`${raw.sourcePlatform.toUpperCase()}\``, inline: true }
    )
    .setFooter({ text: `Job ID: ${jobId} • KSA Jobs Moderation Bot` })
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

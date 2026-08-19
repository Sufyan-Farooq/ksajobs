import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Partials,
} from 'discord.js';
import { logger } from '../scrapers/base.scraper.js';
import { buildJobApprovalEmbed } from './embed-builder.js';
import { handleDiscordButton, handleDiscordModal } from './interaction-handler.js';
import type { ParsedJobData, RawScrapedJob } from '@ksajobs/types';
import type { WhatsAppBroadcaster } from '../whatsapp/whatsapp.service.js';

export class DiscordModerationBot {
  private client: Client;
  private token?: string;
  private pendingChannelId?: string;
  private approvedChannelId?: string;
  private rejectedChannelId?: string;
  private logsChannelId?: string;
  private errorLogsChannelId?: string;
  private consoleLogsChannelId?: string;
  private isReady: boolean = false;
  private whatsAppService?: WhatsAppBroadcaster;

  constructor(whatsAppService?: WhatsAppBroadcaster) {
    this.token = process.env.DISCORD_BOT_TOKEN;
    this.pendingChannelId = process.env.DISCORD_PENDING_CHANNEL_ID;
    this.approvedChannelId = process.env.DISCORD_APPROVED_CHANNEL_ID;
    this.rejectedChannelId = process.env.DISCORD_REJECTED_CHANNEL_ID;
    this.logsChannelId = process.env.DISCORD_LOGS_CHANNEL_ID;
    this.errorLogsChannelId = process.env.DISCORD_ERROR_LOGS_CHANNEL_ID;
    this.consoleLogsChannelId = process.env.DISCORD_CONSOLE_LOGS_CHANNEL_ID;
    this.whatsAppService = whatsAppService;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once('ready', () => {
      this.isReady = true;
      logger.info({ tag: this.client.user?.tag }, '🚀 Discord Moderation Bot connected successfully!');
      this.logToGeneral('🟢 **KSAJobs System Online**: Discord Moderation & Scraper Worker active.');
      this.logToConsole(`🤖 Logged in as **${this.client.user?.tag}** (${new Date().toLocaleString('en-US')})`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isButton()) {
        await handleDiscordButton(interaction, this, this.whatsAppService);
      } else if (interaction.isModalSubmit()) {
        await handleDiscordModal(interaction, this.whatsAppService);
      }
    });

    this.client.on('error', (err) => {
      logger.error({ error: err.message }, 'Discord Client Error');
      this.logToError(`⚠️ **Discord Client Error**: \`${err.message}\``);
    });
  }

  /**
   * Start the Discord Bot
   */
  async start(): Promise<void> {
    if (!this.token) {
      logger.warn('DISCORD_BOT_TOKEN is not configured.');
      return;
    }

    try {
      await this.client.login(this.token);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to login Discord Bot');
    }
  }

  /**
   * Post a pending job to the #jobs-pending approval channel
   */
  async postPendingJob(jobId: string, parsed: ParsedJobData, raw: RawScrapedJob): Promise<string | null> {
    if (!this.isReady || !this.pendingChannelId) {
      logger.warn({ jobId }, 'Discord bot not connected or DISCORD_PENDING_CHANNEL_ID not set');
      return null;
    }

    try {
      const channel = (await this.client.channels.fetch(this.pendingChannelId)) as TextChannel;
      if (!channel || !channel.isTextBased()) return null;

      const { embed, row } = buildJobApprovalEmbed(jobId, parsed, raw);
      const msg = await channel.send({ embeds: [embed], components: [row] });
      return msg.id;
    } catch (err: any) {
      logger.error({ error: err.message, jobId }, 'Failed to post pending job to Discord');
      this.logToError(`❌ Failed to post job \`${jobId}\` to Pending channel: ${err.message}`);
      return null;
    }
  }

  /**
   * Forward approved job embed to #approved channel
   */
  async postApprovedFeed(embed: any): Promise<void> {
    if (!this.isReady || !this.approvedChannelId) return;
    try {
      const channel = (await this.client.channels.fetch(this.approvedChannelId)) as TextChannel;
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not forward to Approved channel');
    }
  }

  /**
   * Forward rejected job embed to #rejected channel
   */
  async postRejectedFeed(embed: any): Promise<void> {
    if (!this.isReady || !this.rejectedChannelId) return;
    try {
      const channel = (await this.client.channels.fetch(this.rejectedChannelId)) as TextChannel;
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not forward to Rejected channel');
    }
  }

  /**
   * Post to #general-logs channel
   */
  async logToGeneral(message: string): Promise<void> {
    if (!this.isReady || !this.logsChannelId) return;
    try {
      const channel = (await this.client.channels.fetch(this.logsChannelId)) as TextChannel;
      if (channel && channel.isTextBased()) await channel.send(message);
    } catch (err) {}
  }

  /**
   * Post to #error-logs channel
   */
  async logToError(message: string): Promise<void> {
    if (!this.isReady || !this.errorLogsChannelId) return;
    try {
      const channel = (await this.client.channels.fetch(this.errorLogsChannelId)) as TextChannel;
      if (channel && channel.isTextBased()) await channel.send(message);
    } catch (err) {}
  }

  /**
   * Post to #console-logs channel
   */
  async logToConsole(message: string): Promise<void> {
    if (!this.isReady || !this.consoleLogsChannelId) return;
    try {
      const channel = (await this.client.channels.fetch(this.consoleLogsChannelId)) as TextChannel;
      if (channel && channel.isTextBased()) await channel.send(message);
    } catch (err) {}
  }
}

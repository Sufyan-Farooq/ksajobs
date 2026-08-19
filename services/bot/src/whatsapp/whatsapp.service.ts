import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { prisma } from '@ksajobs/database';
import { logger } from '../scrapers/base.scraper.js';

interface QueuedBroadcast {
  jobId: string;
  messageText: string;
  city?: string;
  category?: string;
}

export class WhatsAppBroadcaster {
  private socket: WASocket | null = null;
  private isConnected: boolean = false;
  private provider: 'baileys' | 'evolution';
  private queue: QueuedBroadcast[] = [];
  private isProcessingQueue: boolean = false;
  private minDelaySeconds: number = 8;
  private maxDelaySeconds: number = 20;

  constructor() {
    this.provider = (process.env.WHATSAPP_PROVIDER as any) || 'baileys';
  }

  /**
   * Initializes WhatsApp client & automatically syncs joined groups and channels
   */
  async start(): Promise<void> {
    if (this.provider === 'evolution') {
      logger.info('WhatsApp Broadcaster running in Evolution API mode.');
      this.isConnected = true;
      return;
    }

    try {
      const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions/whatsapp';
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      this.socket = makeWASocket({
        version,
        auth: state,
        browser: Browsers.windows('Desktop'),
        printQRInTerminal: false,
        syncFullHistory: false, // Prevents init query timeouts
        defaultQueryTimeoutMs: 60000,
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n======================================================');
          console.log('📲 SCAN THIS WHATSAPP QR CODE WITH YOUR PHONE:');
          console.log('Open WhatsApp > Linked Devices > Link a Device');
          console.log('======================================================\n');
          qrcode.generate(qr, { small: true });
          console.log('\n======================================================\n');

          // Save QR image to web public directory
          try {
            const publicDir = path.resolve(process.cwd(), '../../apps/web/public');
            if (fs.existsSync(publicDir)) {
              await QRCode.toFile(path.join(publicDir, 'whatsapp-qr.png'), qr, { width: 400, margin: 2 });
            }
          } catch (e) {}
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.warn({ shouldReconnect }, 'WhatsApp connection closed');
          this.isConnected = false;
          if (shouldReconnect) {
            setTimeout(() => this.start(), 5000);
          }
        } else if (connection === 'open') {
          console.log('\n🟢 WHATSAPP CONNECTED SUCCESSFULLY!\n');
          logger.info('🟢 WhatsApp Broadcaster connected successfully via Baileys!');
          this.isConnected = true;

          // Automatically discover and sync participating groups & channels
          await this.syncParticipatingGroupsAndChannels();
        }
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to initialize Baileys WhatsApp client');
    }
  }

  /**
   * Automatically discovers and syncs all joined WhatsApp groups and channels (newsletters)
   */
  async syncParticipatingGroupsAndChannels(): Promise<void> {
    if (!this.socket || !this.isConnected) return;

    try {
      logger.info('🔍 Discovering joined WhatsApp groups and channels...');
      
      // 1. Fetch WhatsApp Groups
      const groups = await this.socket.groupFetchAllParticipating();
      const groupList = Object.values(groups);

      for (const group of groupList) {
        const isChannel = group.id.endsWith('@newsletter');
        const existing = await prisma.whatsAppGroup.findUnique({ where: { jid: group.id } });
        if (!existing) {
          await prisma.whatsAppGroup.create({
            data: {
              jid: group.id,
              name: group.subject,
              isChannel: isChannel,
              isActive: false, // DISABLED BY DEFAULT
            },
          });
        } else {
          await prisma.whatsAppGroup.update({
            where: { jid: group.id },
            data: { 
              name: group.subject,
              isChannel: isChannel,
            },
          });
        }
      }

      // 2. Discover / Sync WhatsApp Channels (Newsletters)
      try {
        const defaultChannelInvite = '0029VaV5YUCBadmh65NdqH46';
        if (typeof (this.socket as any).newsletterMetadata === 'function') {
          const channelMeta = await (this.socket as any).newsletterMetadata('invite', defaultChannelInvite);
          if (channelMeta && channelMeta.id) {
            const channelJid = channelMeta.id;
            const channelName = channelMeta.name || 'KSA JOBS Official Channel';

            const existingChannel = await prisma.whatsAppGroup.findUnique({ where: { jid: channelJid } });
            if (!existingChannel) {
              await prisma.whatsAppGroup.create({
                data: {
                  jid: channelJid,
                  name: `📢 ${channelName}`,
                  isChannel: true,
                  isActive: false, // DISABLED BY DEFAULT
                },
              });
              logger.info({ channelJid, channelName }, '✅ Official WhatsApp Channel synced to database');
            } else {
              await prisma.whatsAppGroup.update({
                where: { jid: channelJid },
                data: { isChannel: true },
              });
            }
          }
        }
      } catch (channelErr: any) {
        logger.info({ info: channelErr.message }, 'WhatsApp Channel invite query note');
      }

      const totalCount = await prisma.whatsAppGroup.count();
      const channelCount = await prisma.whatsAppGroup.count({ where: { isChannel: true } });
      const groupCount = await prisma.whatsAppGroup.count({ where: { isChannel: false } });

      logger.info({ totalCount, groupCount, channelCount }, '✅ Synced WhatsApp groups & channels to database (All disabled by default)');
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not fetch participating groups');
    }
  }

  /**
   * Schedules a broadcast for an approved job across all active groups and channels
   */
  async broadcastJob(jobId: string, messageText: string, city?: string, category?: string): Promise<void> {
    logger.info({ jobId }, 'Queueing approved job for WhatsApp broadcast...');
    this.queue.push({ jobId, messageText, city, category });
    this.processQueue();
  }

  /**
   * Broadcasts directly to all active channels and groups with humanized jitter delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        // Find all active groups / channels matching city or category filters
        const targetGroups = await prisma.whatsAppGroup.findMany({
          where: {
            isActive: true,
            OR: [
              { cityFilter: null },
              { cityFilter: { equals: item.city || '', mode: 'insensitive' } },
            ],
          },
        });

        if (targetGroups.length === 0) {
          logger.info(
            { jobId: item.jobId },
            'No active WhatsApp groups or channels enabled. Broadcast skipped safely.'
          );
          continue;
        }

        logger.info(
          { count: targetGroups.length, jobId: item.jobId },
          'Starting sequential broadcast to active WhatsApp targets...'
        );

        for (const target of targetGroups) {
          await this.sendWithRetry(target.jid, item.messageText, item.jobId, target.id);
          
          // Anti-ban random delay
          const delaySec = Math.floor(Math.random() * (this.maxDelaySeconds - this.minDelaySeconds + 1)) + this.minDelaySeconds;
          logger.info({ delaySec, nextTarget: target.name }, 'Throttling broadcast between targets (anti-ban protection)...');
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        }
      } catch (err: any) {
        logger.error({ error: err.message, jobId: item.jobId }, 'Error processing broadcast queue item');
      }
    }

    this.isProcessingQueue = false;
  }

  private async sendWithRetry(
    jid: string,
    text: string,
    jobId: string,
    groupId: string,
    retries = 2
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.provider === 'baileys') {
          if (!this.socket || !this.isConnected) {
            throw new Error('Baileys socket is not connected');
          }
          await this.socket.sendMessage(jid, { text });
        } else {
          // Evolution API fallback
          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const instance = process.env.EVOLUTION_INSTANCE_NAME || 'ksajobs';

          if (!evoUrl || !evoKey) {
            throw new Error('Evolution API credentials missing');
          }

          await axios.post(
            `${evoUrl}/message/sendText/${instance}`,
            {
              number: jid,
              textMessage: { text },
              options: { delay: 1200, presence: 'composing' },
            },
            { headers: { apikey: evoKey } }
          );
        }

        logger.info({ jid, jobId, attempt }, 'Successfully delivered broadcast message to WhatsApp target');

        // Log broadcast to database
        await prisma.broadcastLog.create({
          data: {
            jobId,
            groupId,
            status: 'SENT',
          },
        });

        return true;
      } catch (err: any) {
        logger.warn({ error: err.message, jid, attempt }, 'Broadcast delivery failed, retrying...');
        if (attempt === retries) {
          await prisma.broadcastLog.create({
            data: {
              jobId,
              groupId,
              status: 'FAILED',
              error: err.message,
            },
          });
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    return false;
  }
}

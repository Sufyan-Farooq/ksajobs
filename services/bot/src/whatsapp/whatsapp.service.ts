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
        // Find existing record to preserve user choice
        const existing = await prisma.whatsAppGroup.findUnique({ where: { jid: group.id } });
        if (!existing) {
          await prisma.whatsAppGroup.create({
            data: {
              jid: group.id,
              name: group.subject,
              isActive: false, // DISABLED BY DEFAULT
            },
          });
        } else {
          await prisma.whatsAppGroup.update({
            where: { jid: group.id },
            data: { name: group.subject },
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
                  name: `📢 ${channelName} (Official Channel)`,
                  isActive: false, // DISABLED BY DEFAULT
                },
              });
              logger.info({ channelJid, channelName }, '✅ Official WhatsApp Channel synced to database');
            }
          }
        }
      } catch (channelErr: any) {
        logger.info({ info: channelErr.message }, 'WhatsApp Channel invite query note');
      }

      logger.info({ groupCount: groupList.length }, '✅ Synced WhatsApp groups & channels to database (All disabled by default)');
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not automatically fetch WhatsApp groups');
    }
  }

  /**
   * Enqueues a job message to be broadcasted to active WhatsApp groups and channels
   */
  enqueueBroadcast(jobId: string, messageText: string, city?: string, category?: string) {
    this.queue.push({ jobId, messageText, city, category });
    logger.info({ jobId, queueSize: this.queue.length }, 'Job added to WhatsApp broadcast queue');
    this.processQueue();
  }

  /**
   * Safe queue processor with human typing simulation and 8-20s randomized intervals
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        // Fetch only enabled/active groups from database
        const activeGroups = await prisma.whatsAppGroup.findMany({
          where: { isActive: true },
        });

        if (activeGroups.length === 0) {
          logger.warn({ jobId: item.jobId }, 'No active WhatsApp groups selected in database.');
          continue;
        }

        for (const group of activeGroups) {
          if (group.cityFilter && item.city && !item.city.toLowerCase().includes(group.cityFilter.toLowerCase())) {
            continue;
          }

          try {
            // 1. Simulate human presence: "typing..." for 1.5 - 3.5 seconds (skip for newsletters)
            if (this.socket && this.isConnected && !group.jid.endsWith('@newsletter')) {
              await this.socket.sendPresenceUpdate('composing', group.jid);
              const typingDelay = Math.floor(Math.random() * 2000) + 1500;
              await new Promise((r) => setTimeout(r, typingDelay));
              await this.socket.sendPresenceUpdate('paused', group.jid);
            }

            // 2. Dispatch message
            await this.sendMessageToDestination(group.jid, item.messageText);

            // 3. Record log
            await prisma.broadcastLog.create({
              data: {
                jobId: item.jobId,
                groupId: group.id,
                status: 'SUCCESS',
              },
            });

            logger.info({ destinationName: group.name, jid: group.jid, jobId: item.jobId }, 'Broadcasted job to WhatsApp');
          } catch (err: any) {
            logger.error({ destinationName: group.name, error: err.message }, 'Failed sending to WhatsApp destination');

            await prisma.broadcastLog.create({
              data: {
                jobId: item.jobId,
                groupId: group.id,
                status: 'FAILED',
                error: err.message,
              },
            });
          }

          // 4. Safe randomized interval (8 to 20 seconds)
          const randomWaitSeconds =
            Math.floor(Math.random() * (this.maxDelaySeconds - this.minDelaySeconds + 1)) +
            this.minDelaySeconds;

          logger.info({ waitSeconds: randomWaitSeconds }, 'Applying anti-ban pause before next broadcast...');
          await new Promise((resolve) => setTimeout(resolve, randomWaitSeconds * 1000));
        }
      } catch (err: any) {
        logger.error({ error: err.message }, 'Error in WhatsApp queue execution');
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Dispatches message to group JID (@g.us) or Channel / Newsletter JID (@newsletter)
   */
  private async sendMessageToDestination(jid: string, text: string): Promise<void> {
    if (this.provider === 'evolution') {
      const apiUrl = process.env.WHATSAPP_EVOLUTION_API_URL;
      const apiKey = process.env.WHATSAPP_EVOLUTION_API_KEY;
      const instance = process.env.WHATSAPP_EVOLUTION_INSTANCE_NAME || 'ksajobs-bot';

      if (!apiUrl) throw new Error('WHATSAPP_EVOLUTION_API_URL is required for Evolution API mode');

      await axios.post(
        `${apiUrl}/message/sendText/${instance}`,
        {
          number: jid,
          options: { delay: 1200, presence: 'composing', linkPreview: true },
          textMessage: { text },
        },
        {
          headers: { apikey: apiKey || '' },
        }
      );
      return;
    }

    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    await this.socket.sendMessage(jid, { text });
  }
}

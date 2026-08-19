import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import { GeminiJobParser } from './ai/gemini.service.js';
import { DiscordModerationBot } from './discord/discord.bot.js';
import { WhatsAppBroadcaster } from './whatsapp/whatsapp.service.js';
import { IngestionPipeline } from './pipeline.js';
import { GmailCVIngestionWorker } from './cv/gmail-ingestion.worker.js';
import { logger } from './scrapers/base.scraper.js';

async function bootstrap() {
  logger.info('🚀 Initializing KSA Jobs Ingestion & Moderation Service...');

  // 1. Initialize WhatsApp Service (auto-discovers groups)
  const whatsAppService = new WhatsAppBroadcaster();
  await whatsAppService.start();

  // 2. Initialize Discord Moderation Bot
  const discordBot = new DiscordModerationBot(whatsAppService);
  await discordBot.start();

  // 3. Initialize Gemini AI Parser (100% English + Fixed Template)
  const parser = new GeminiJobParser();

  // 4. Initialize Pipeline & Gmail CV Worker
  const pipeline = new IngestionPipeline(parser, discordBot, whatsAppService);
  const gmailWorker = new GmailCVIngestionWorker();

  // 5. Initial Thorough Past-Day Run on Startup
  logger.info('⚡ Running initial thorough sweep of all jobs posted in the past 24 hours...');
  setTimeout(async () => {
    try {
      await pipeline.runCycle(undefined, 25);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error in initial startup sweep');
    }

    // Run initial Gmail scan if configured
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      logger.info('📧 Scanning Gmail inbox for candidate CVs/resumes...');
      try {
        await gmailWorker.scanInbox({ scanAllHistory: true, maxEmails: 50 });
      } catch (e: any) {
        logger.warn({ error: e.message }, 'Initial Gmail CV scan error');
      }
    }
  }, 5000);

  // 6. Schedule Periodic 1-Hour Cron Job
  const cronInterval = process.env.SCRAPER_CRON_INTERVAL || '0 * * * *';
  const maxJobs = parseInt(process.env.SCRAPER_MAX_JOBS_PER_RUN || '20', 10);

  logger.info({ cronInterval, maxJobs }, '⏰ Scheduling automated 1-hour job scraper & Gmail CV monitor...');

  cron.schedule(cronInterval, async () => {
    logger.info('⏰ Hourly Cron Triggered: Checking for new KSA job postings & candidate emails...');
    try {
      await pipeline.runCycle(undefined, maxJobs);
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        await gmailWorker.scanInbox({ scanAllHistory: false, maxEmails: 25 });
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Scheduled 1-hour cycle encountered an error');
    }
  });

  logger.info('🟢 KSA Jobs Background Bot, Scrapers & CV Ingestion Worker is running!');
}

bootstrap().catch((err) => {
  logger.error({ error: err.message }, 'Fatal crash during bootstrap');
  process.exit(1);
});

import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import { GeminiJobParser } from './ai/gemini.service.js';
import { DiscordModerationBot } from './discord/discord.bot.js';
import { WhatsAppBroadcaster } from './whatsapp/whatsapp.service.js';
import { IngestionPipeline } from './pipeline.js';
import { logger } from './scrapers/base.scraper.js';

async function bootstrap() {
  logger.info('🚀 Initializing KSA Jobs Ingestion & Moderation Service...');

  // 1. Initialize WhatsApp Service (auto-discovers groups & channels)
  const whatsAppService = new WhatsAppBroadcaster();
  await whatsAppService.start();

  // 2. Initialize Discord Moderation Bot
  const discordBot = new DiscordModerationBot(whatsAppService);
  await discordBot.start();

  // 3. Initialize Gemini AI Parser (100% English + Fixed Template)
  const parser = new GeminiJobParser();

  // 4. Initialize Pipeline
  const pipeline = new IngestionPipeline(parser, discordBot, whatsAppService);

  // 5. Initial Thorough Past-Day Run on Startup
  logger.info('⚡ Running initial thorough sweep of all jobs posted in the past 24 hours...');
  setTimeout(async () => {
    try {
      await pipeline.runCycle(undefined, 25);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error in initial startup sweep');
    }
  }, 5000);

  // 6. Schedule Periodic Automated Scraper Cron Job
  const cronInterval = process.env.SCRAPER_CRON_INTERVAL || '0 * * * *';
  const maxJobs = parseInt(process.env.SCRAPER_MAX_JOBS_PER_RUN || '20', 10);

  logger.info({ cronInterval, maxJobs }, '⏰ Scheduling automated 1-hour job scraper...');

  cron.schedule(cronInterval, async () => {
    logger.info('⏰ Scheduled Cron Triggered: Checking for new KSA job postings...');
    try {
      await pipeline.runCycle(undefined, maxJobs);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error in scheduled job scrape run');
    }
  });

  logger.info('🟢 KSA Jobs Background Bot, Scrapers & Moderation Service is running!');
}

bootstrap().catch((err) => {
  logger.error({ error: err.message }, 'Fatal error during bot initialization');
  process.exit(1);
});

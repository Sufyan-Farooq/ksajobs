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

  // 6. Schedule Periodic Automated Scraper Cron Job (Every 2 Hours)
  const cronInterval = process.env.SCRAPER_CRON_INTERVAL || '0 */2 * * *';
  const maxJobs = parseInt(process.env.SCRAPER_MAX_JOBS_PER_RUN || '30', 10);

  logger.info(
    { cronInterval, maxJobs, reportChannel: process.env.DISCORD_LOGS_CHANNEL_ID || '1539689386596376656' },
    '⏰ Scheduling automated 2-hour job scraper & Discord cycle reports...'
  );

  cron.schedule(cronInterval, async () => {
    logger.info('⏰ 2-Hour Scheduled Cron Triggered: Checking for fresh KSA job postings...');
    try {
      await pipeline.runCycle(undefined, maxJobs);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error in scheduled 2-hour job scrape run');
    }
  });

  logger.info('🟢 KSA Jobs Background Bot, Scrapers & Moderation Service is running!');
}

bootstrap().catch((err) => {
  logger.error({ error: err.message }, 'Fatal error during bot initialization');
  process.exit(1);
});

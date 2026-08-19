import { scrapers, runAllScrapers } from './scrapers/index.js';
import { GeminiJobParser } from './ai/gemini.service.js';
import { DiscordModerationBot } from './discord/discord.bot.js';
import { WhatsAppBroadcaster } from './whatsapp/whatsapp.service.js';
import { jobRepository, prisma } from '@ksajobs/database';
import { logger } from './scrapers/base.scraper.js';
import type { SourcePlatform } from '@ksajobs/types';

export class IngestionPipeline {
  private parser: GeminiJobParser;
  private discordBot: DiscordModerationBot;
  private whatsAppService: WhatsAppBroadcaster;

  constructor(
    parser: GeminiJobParser,
    discordBot: DiscordModerationBot,
    whatsAppService: WhatsAppBroadcaster
  ) {
    this.parser = parser;
    this.discordBot = discordBot;
    this.whatsAppService = whatsAppService;
  }

  /**
   * Run a full scrape, AI parse, and Discord ingestion cycle
   */
  async runCycle(platform?: SourcePlatform, maxJobsPerPlatform: number = 10) {
    logger.info({ platform: platform || 'all' }, 'Starting job ingestion cycle...');
    const startTime = new Date();

    const targetScrapers = platform
      ? [scrapers[platform]].filter(Boolean)
      : Object.values(scrapers);

    let totalFound = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;

    for (const scraper of targetScrapers) {
      const runLog = await prisma.scraperRunLog.create({
        data: {
          platform: scraper.platform,
          startedAt: new Date(),
        },
      });

      let found = 0;
      let inserted = 0;
      let duplicates = 0;

      try {
        const rawJobs = await scraper.scrape(maxJobsPerPlatform);
        found = rawJobs.length;
        totalFound += found;

        for (const raw of rawJobs) {
          // 1. Deduplication check
          const exists = await jobRepository.existsBySourceUrl(raw.sourceUrl);
          if (exists) {
            duplicates++;
            totalDuplicates++;
            continue;
          }

          // 2. AI Parse & Enrich
          logger.info({ title: raw.title, platform: raw.sourcePlatform }, 'Enriching job with AI...');
          const parsed = await this.parser.parse(raw);

          // 3. Save to database as PENDING_APPROVAL
          const jobRecord = await jobRepository.createPendingJob(raw, parsed);
          inserted++;
          totalInserted++;

          // 4. Send to Discord #jobs-pending approval queue
          const discordMsgId = await this.discordBot.postPendingJob(jobRecord.id, parsed, raw);
          if (discordMsgId) {
            await jobRepository.setDiscordMessageId(jobRecord.id, discordMsgId);
          }
        }

        await prisma.scraperRunLog.update({
          where: { id: runLog.id },
          data: {
            jobsFound: found,
            jobsInserted: inserted,
            jobsDuplicates: duplicates,
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        logger.error({ platform: scraper.platform, error: err.message }, 'Scraper error during cycle');
        await prisma.scraperRunLog.update({
          where: { id: runLog.id },
          data: {
            errors: err.message,
            completedAt: new Date(),
          },
        });
      }
    }

    const summaryMsg = `📊 **Scrape Cycle Completed**: Found ${totalFound} jobs | 📥 ${totalInserted} new pending review | 🔁 ${totalDuplicates} duplicates skipped.`;
    logger.info(summaryMsg);
    await this.discordBot.logToGeneral(summaryMsg);
  }
}

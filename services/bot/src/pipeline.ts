import { scrapers } from './scrapers/index.js';
import { GeminiJobParser } from './ai/gemini.service.js';
import { DiscordModerationBot, PlatformCycleStats } from './discord/discord.bot.js';
import { WhatsAppBroadcaster } from './whatsapp/whatsapp.service.js';
import { jobRepository, prisma } from '@ksajobs/database';
import { logger } from './scrapers/base.scraper.js';
import { isStrictlyInSaudiArabia } from './utils/geo-validator.js';
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
  async runCycle(platform?: SourcePlatform, maxJobsPerPlatform: number = 25) {
    logger.info({ platform: platform || 'all' }, 'Starting job ingestion cycle...');
    const startTime = Date.now();

    const targetScrapers = platform
      ? [scrapers[platform]].filter(Boolean)
      : Object.values(scrapers);

    let totalFound = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;

    const platformStats: PlatformCycleStats[] = [];
    const newJobsSample: { title: string; company: string; city: string; platform: string }[] = [];

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
          // 1. Strict Centralized Geolocation Filter (rejects foreign jobs from Korea, US, UK, etc.)
          if (!isStrictlyInSaudiArabia({
            url: raw.sourceUrl,
            location: raw.locationRaw,
            title: raw.title,
            description: raw.descriptionRaw,
          })) {
            logger.warn({ title: raw.title, location: raw.locationRaw, url: raw.sourceUrl }, '🛡️ Central Gatekeeper discarded foreign non-KSA job');
            continue;
          }

          // 2. Deduplication check
          const exists = await jobRepository.existsBySourceUrl(raw.sourceUrl);
          if (exists) {
            duplicates++;
            totalDuplicates++;
            continue;
          }

          // 3. AI Parse & Enrich with graceful rate-limit delay
          logger.info({ title: raw.title, platform: raw.sourcePlatform }, 'Enriching job with AI...');
          const parsed = await this.parser.parse(raw);

          // 4. Save to database as PENDING_APPROVAL
          const jobRecord = await jobRepository.createPendingJob(raw, parsed);
          inserted++;
          totalInserted++;

          if (newJobsSample.length < 8) {
            newJobsSample.push({
              title: parsed.titleEn || raw.title,
              company: parsed.companyName || raw.companyName || 'Saudi Employer',
              city: parsed.cityEn || 'Saudi Arabia',
              platform: raw.sourcePlatform,
            });
          }

          // 5. Send to Discord #jobs-pending approval queue
          const discordMsgId = await this.discordBot.postPendingJob(jobRecord.id, parsed, raw);
          if (discordMsgId) {
            await jobRepository.setDiscordMessageId(jobRecord.id, discordMsgId);
          }

          // Gentle throttling between AI calls
          await new Promise((r) => setTimeout(r, 1200));
        }

        await prisma.scraperRunLog.update({
          where: { id: runLog.id },
          data: {
            jobsFound: found,
            jobsInserted: inserted,
            jobsDuplicate: duplicates,
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        logger.error({ platform: scraper.platform, error: err.message }, 'Scraper error during cycle');
        await prisma.scraperRunLog.update({
          where: { id: runLog.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
            completedAt: new Date(),
          },
        });
      }

      platformStats.push({
        platform: scraper.platform,
        found,
        inserted,
        duplicates,
      });
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const summaryMsg = `📊 **Scrape Cycle Completed**: Found ${totalFound} jobs | 📥 ${totalInserted} new pending review | 🔁 ${totalDuplicates} duplicates skipped.`;
    logger.info({ durationSeconds }, summaryMsg);

    // Send rich summary report to dedicated Discord Channel 1539689386596376656
    await this.discordBot.sendCycleSummaryReport({
      durationSeconds,
      totalFound,
      totalInserted,
      totalDuplicates,
      platforms: platformStats,
      newJobsSample,
    });
  }
}

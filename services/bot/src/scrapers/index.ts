import { LinkedInScraper } from './linkedin.scraper.js';
import { BaytScraper } from './bayt.scraper.js';
import { TanqeebScraper } from './tanqeeb.scraper.js';
import { ExpatriatesScraper } from './expatriates.scraper.js';
import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';

export const scrapers: Record<string, BaseScraper> = {
  linkedin: new LinkedInScraper(),
  bayt: new BaytScraper(),
  tanqeeb: new TanqeebScraper(),
  expatriates: new ExpatriatesScraper(),
};

export async function runScraper(platform: SourcePlatform, maxJobs: number = 10): Promise<RawScrapedJob[]> {
  const scraper = scrapers[platform];
  if (!scraper) {
    throw new Error(`Unknown scraper platform: ${platform}`);
  }
  return scraper.scrape(maxJobs);
}

export async function runAllScrapers(maxJobsPerPlatform: number = 10): Promise<RawScrapedJob[]> {
  const allJobs: RawScrapedJob[] = [];

  for (const [name, scraper] of Object.entries(scrapers)) {
    try {
      logger.info({ platform: name }, `Running scraper ${name}...`);
      const jobs = await scraper.scrape(maxJobsPerPlatform);
      allJobs.push(...jobs);
    } catch (err: any) {
      logger.error({ platform: name, error: err.message }, `Failed running scraper ${name}`);
    }
  }

  return allJobs;
}

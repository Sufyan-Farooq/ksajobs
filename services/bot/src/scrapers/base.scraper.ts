import type { RawScrapedJob, SourcePlatform, ScraperStats } from '@ksajobs/types';
import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export abstract class BaseScraper {
  abstract readonly platform: SourcePlatform;
  protected client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });
  }

  /**
   * Scrapes jobs from the target source
   * @param maxJobs Maximum number of jobs to fetch in this batch
   */
  abstract scrape(maxJobs?: number): Promise<RawScrapedJob[]>;

  /**
   * Safe random sleep helper to prevent rate limits
   */
  protected async sleep(msMin: number, msMax: number = msMin): Promise<void> {
    const delay = Math.floor(Math.random() * (msMax - msMin + 1)) + msMin;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Clean and normalize raw HTML text
   */
  protected cleanText(text?: string | null): string {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

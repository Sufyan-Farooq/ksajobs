import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class TanqeebScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'tanqeeb';

  /**
   * Scrapes verified Saudi Arabia Tanqeeb listings with full detail extraction and English URLs
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://saudi.tanqeeb.com/en/jobs/search?country=saudi-arabia';

    logger.info({ platform: this.platform, maxJobs }, 'Starting Tanqeeb KSA browser scraper...');

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      // Index context
      const indexCtx = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        locale: 'en-US',
      });
      await indexCtx.addInitScript(() => {
        delete (Object.getPrototypeOf(navigator) as any).webdriver;
      });

      const indexPage = await indexCtx.newPage();
      await indexPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await indexPage.waitForTimeout(3000);

      const html = await indexPage.content();
      const $ = cheerio.load(html);

      const links: { title: string; href: string }[] = [];

      $('a[href*=".html"]').each((_, el) => {
        const item = $(el);
        const title = this.cleanText(item.text());
        const href = item.attr('href') || '';

        if (!title || !href || title.length < 4) return;
        if (!href.includes('/jobs/') && !href.includes('/jobs-in-saudi/')) return;
        if (href.includes('/jobs-in-uae/') || href.includes('/jobs-in-lebanon/') || href.includes('/jobs-in-egypt/')) {
          return;
        }

        const fullUrl = href.startsWith('http') ? href : `https://saudi.tanqeeb.com${href}`;
        // Ensure English URL
        const cleanUrl = fullUrl.replace('https://saudi.tanqeeb.com/ar/', 'https://saudi.tanqeeb.com/en/').split('?')[0];

        if (!links.some((l) => l.href === cleanUrl)) {
          links.push({ title, href: cleanUrl });
        }
      });

      await indexCtx.close();
      logger.info({ count: links.length }, 'Found Tanqeeb listings on page');

      for (const item of links) {
        if (jobs.length >= maxJobs) break;

        try {
          const detailCtx = await browser.newContext({
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            locale: 'en-US',
          });
          await detailCtx.addInitScript(() => {
            delete (Object.getPrototypeOf(navigator) as any).webdriver;
          });

          const page = await detailCtx.newPage();
          await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await page.waitForTimeout(3500);

          const fullHtml = await page.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          $detail('script, style, iframe, header, footer, nav, .cookie-banner').remove();

          // Title
          let pageTitle = item.title;
          const metaTitle = $detail('title').text().trim();
          if (metaTitle && metaTitle.includes('|')) {
            pageTitle = metaTitle.split('|')[0].trim();
          }

          // Location
          let location = 'Saudi Arabia';
          if (metaTitle && metaTitle.includes('Jobs')) {
            const parts = metaTitle.split('|');
            if (parts.length > 1 && parts[1].includes('Jobs')) {
              location = `${parts[1].replace('Jobs', '').trim()}, Saudi Arabia`;
            }
          }

          // Tags & Description
          const tags = $detail('.job-tags').text().trim().replace(/\s+/g, ' ');
          const rawBody = $detail('p, .job-description, .content')
            .map((_, el) => $detail(el).text().trim())
            .get()
            .filter((t) => t.length > 15)
            .join('\n');

          const description = `${pageTitle}\nLocation: ${location}\n${tags ? `Job Type: ${tags}\n` : ''}${rawBody || `${pageTitle} in ${location}. Apply directly on Tanqeeb.`}`;

          jobs.push({
            sourcePlatform: 'tanqeeb',
            sourceUrl: item.href,
            title: pageTitle,
            companyName: 'Saudi Enterprise',
            locationRaw: location,
            descriptionRaw: description,
            applyUrl: item.href,
          });

          await this.sleep(300, 600);
        } catch (detailErr: any) {
          logger.warn({ error: detailErr.message, url: item.href }, 'Could not load Tanqeeb detail page');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error scraping Tanqeeb KSA');
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'Tanqeeb scraping completed');
    return jobs;
  }
}

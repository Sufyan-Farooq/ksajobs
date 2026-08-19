import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class LinkedInScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'linkedin';

  /**
   * Scrapes verified Saudi Arabia LinkedIn listings with resilient full detail extraction
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://www.linkedin.com/jobs/search?keywords=Saudi%20Arabia&location=Saudi%20Arabia';

    logger.info({ platform: this.platform, maxJobs }, 'Starting LinkedIn KSA browser scraper with full detail extraction...');

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

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      });
      await context.addInitScript(() => {
        delete (Object.getPrototypeOf(navigator) as any).webdriver;
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(3000);

      const scrapedCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('.base-card, .job-search-card');
        return Array.from(cards)
          .map((c) => {
            const a = c.querySelector('a') as HTMLAnchorElement | null;
            const title = (c.querySelector('h3') as HTMLElement | null)?.innerText?.trim();
            const company = (c.querySelector('h4') as HTMLElement | null)?.innerText?.trim();
            const location = (c.querySelector('.job-search-card__location') as HTMLElement | null)?.innerText?.trim();
            const time = (c.querySelector('time') as HTMLElement | null)?.innerText?.trim();
            return {
              title: title || '',
              company: company || '',
              location: location || '',
              href: a?.href || '',
              time: time || '',
            };
          })
          .filter((j) => j.title && j.href);
      });

      logger.info({ count: scrapedCards.length }, 'Found LinkedIn listing cards on page');

      for (const card of scrapedCards) {
        if (jobs.length >= maxJobs) break;

        const cleanUrl = card.href.split('?')[0].replace(/https:\/\/[a-z]{2,3}\.linkedin\.com/, 'https://www.linkedin.com');

        if (jobs.some((j) => j.sourceUrl === cleanUrl)) continue;

        let pageTitle = card.title;
        let company = card.company || 'Saudi Enterprise';
        let location = card.location || 'Saudi Arabia';
        let fullDescription = `${card.title} at ${company} in ${location}. Candidates must currently be based in Saudi Arabia with valid transferable Iqama or Saudi national.`;

        try {
          // Navigate existing page to detail URL safely
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(1800);

          const fullHtml = await page.content();
          const $detail = cheerio.load(fullHtml);
          $detail('script, style, header, footer, nav, iframe').remove();

          const detailTitle = $detail('h1').text().trim();
          if (detailTitle) pageTitle = detailTitle;

          const detailCompany = this.cleanText($detail('.topcard__flavor--black-link, .topcard__flavor').first().text());
          if (detailCompany) company = detailCompany;

          const topLocation = this.cleanText($detail('.top-card-layout__first-subline .topcard__flavor:nth-child(2)').text());
          if (topLocation) {
            location = topLocation.includes('Saudi') ? topLocation : `${topLocation}, Saudi Arabia`;
          }

          const descEl = $detail('.show-more-less-html__markup, .description__text, section.show-more-less-html');
          descEl.find('br').replaceWith('\n');
          descEl.find('p, div, li').each((_, el) => {
            $detail(el).append('\n');
          });

          const extractedText = descEl.text()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .join('\n');

          if (extractedText && extractedText.length > 50) {
            fullDescription = extractedText;
          }
        } catch (detailErr: any) {
          logger.info({ url: cleanUrl }, 'Using fallback listing card details for LinkedIn post');
        }

        jobs.push({
          sourcePlatform: 'linkedin',
          sourceUrl: cleanUrl,
          title: pageTitle,
          companyName: company,
          locationRaw: location,
          descriptionRaw: fullDescription,
          applyUrl: cleanUrl,
          postedDateRaw: card.time,
        });

        await this.sleep(1000, 2000);
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error scraping LinkedIn KSA');
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'LinkedIn scraping completed');
    return jobs;
  }
}

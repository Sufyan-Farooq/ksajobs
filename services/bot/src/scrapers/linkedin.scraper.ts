import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class LinkedInScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'linkedin';

  /**
   * Scrapes verified Saudi Arabia LinkedIn listings with FULL detail page extraction
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

      // Index Context
      const indexContext = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      });
      await indexContext.addInitScript(() => {
        delete (Object.getPrototypeOf(navigator) as any).webdriver;
      });

      const page = await indexContext.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(3500);

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

      await indexContext.close();
      logger.info({ count: scrapedCards.length }, 'Found LinkedIn listing cards on page');

      for (const card of scrapedCards) {
        if (jobs.length >= maxJobs) break;

        const cleanUrl = card.href.split('?')[0].replace(/https:\/\/[a-z]{2,3}\.linkedin\.com/, 'https://www.linkedin.com');

        if (jobs.some((j) => j.sourceUrl === cleanUrl)) continue;

        try {
          // Open detail page with fresh stealth context to extract full description
          const detailCtx = await browser.newContext({
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            locale: 'en-US',
          });
          await detailCtx.addInitScript(() => {
            delete (Object.getPrototypeOf(navigator) as any).webdriver;
          });

          const detailPage = await detailCtx.newPage();
          await detailPage.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await detailPage.waitForTimeout(3500);

          const fullHtml = await detailPage.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          $detail('script, style, header, footer, nav, iframe').remove();

          const pageTitle = $detail('h1').text().trim() || card.title;
          const company = this.cleanText($detail('.topcard__flavor--black-link, .topcard__flavor').first().text()) || card.company || 'Saudi Enterprise';
          
          let location = card.location || 'Saudi Arabia';
          const topLocation = this.cleanText($detail('.top-card-layout__first-subline .topcard__flavor:nth-child(2)').text());
          if (topLocation) {
            location = topLocation.includes('Saudi') ? topLocation : `${topLocation}, Saudi Arabia`;
          }

          // Extract full rich job description
          const descEl = $detail('.show-more-less-html__markup, .description__text, section.show-more-less-html');
          descEl.find('br').replaceWith('\n');
          descEl.find('p, div, li').each((_, el) => {
            $detail(el).append('\n');
          });

          let fullDescription = descEl.text()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .join('\n');

          if (!fullDescription || fullDescription.length < 30) {
            fullDescription = `${pageTitle} at ${company} in ${location}. Candidates must currently be based in Saudi Arabia with valid transferable Iqama or Saudi national.`;
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

          await this.sleep(300, 600);
        } catch (detailErr: any) {
          logger.warn({ error: detailErr.message, url: cleanUrl }, 'Could not load LinkedIn detail page');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error scraping LinkedIn KSA');
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'LinkedIn scraping completed');
    return jobs;
  }
}

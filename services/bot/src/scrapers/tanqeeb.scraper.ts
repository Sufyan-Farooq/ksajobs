import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class TanqeebScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'tanqeeb';

  /**
   * Scrapes genuine Tanqeeb KSA job vacancies with full details & bullet points
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://saudi.tanqeeb.com/en/jobs-in-saudi/all/jobs/0.html';

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

      // Extract listing links from cards
      $('a[href*="/jobs/"]').each((_, el) => {
        const href = $(el).attr('href');
        const title = this.cleanText($(el).text());

        if (
          !href ||
          !title ||
          title.length < 5 ||
          href.includes('/category/') ||
          href.includes('/country/') ||
          href.includes('/city/') ||
          href.includes('/roles/') ||
          title.includes('Find Related Jobs') ||
          title.includes('Discover More') ||
          title.includes('Looking to Hire')
        ) {
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
          await page.waitForTimeout(2500);

          const fullHtml = await page.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          $detail('script, style, iframe, header, footer, nav, .cookie-banner, .similar-jobs-container, .similar-job-item, [class*="similar"]').remove();

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

          // Extract richest job description card preserving all bullets and line breaks
          let bestCardText = '';
          let maxLen = 0;

          $detail('.card').each((_, el) => {
            const cardEl = $detail(el);
            const raw = cardEl.text();
            if (
              !raw.includes('Discover More Opportunities') &&
              !raw.includes('Looking to Hire?') &&
              !raw.includes('Find Related Jobs') &&
              !raw.includes('Similar Jobs') &&
              !raw.includes('Apply on the Job Website')
            ) {
              cardEl.find('br').replaceWith('\n');
              cardEl.find('p, div, li, h2, h3, h4, h5').each((_, node) => {
                $detail(node).append('\n');
              });
              const lines = cardEl.text()
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.includes('Show Arabic translation') && !l.includes('Show English translation'));
              
              const clean = lines.join('\n');
              if (clean.length > maxLen) {
                maxLen = clean.length;
                bestCardText = clean;
              }
            }
          });

          // If bestCardText has both English and Tanqeeb's auto-appended Arabic block, keep the English section
          let finalDescription = bestCardText;
          if (finalDescription.includes('في ') && /[a-zA-Z]{4,}/.test(finalDescription.slice(0, 300))) {
            const splitArabic = finalDescription.search(/[\u0600-\u06FF]{4,}/);
            if (splitArabic > 200) {
              finalDescription = finalDescription.slice(0, splitArabic).trim();
            }
          }

          // Filter out foreign non-Saudi postings (e.g. Missouri, USA)
          const lowerDesc = finalDescription.toLowerCase();
          if (
            (lowerDesc.includes('missouri') || lowerDesc.includes('united states') || lowerDesc.includes('401(k)')) &&
            lowerDesc.includes('$') &&
            !lowerDesc.includes('riyadh') &&
            !lowerDesc.includes('jeddah') &&
            !lowerDesc.includes('dammam')
          ) {
            logger.info({ title: pageTitle }, 'Skipping foreign non-Saudi job posting indexed on Tanqeeb');
            continue;
          }

          jobs.push({
            sourcePlatform: 'tanqeeb',
            sourceUrl: item.href,
            title: pageTitle,
            companyName: 'Saudi Enterprise',
            locationRaw: location,
            descriptionRaw: finalDescription || `${pageTitle} in ${location}. Apply directly on Tanqeeb.`,
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

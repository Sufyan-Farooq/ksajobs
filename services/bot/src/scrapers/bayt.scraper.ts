import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class BaytScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'bayt';

  /**
   * Scrapes Bayt.com KSA genuine job vacancies (filters out navigation/category links)
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://www.bayt.com/en/saudi-arabia/jobs/';

    logger.info({ platform: this.platform, maxJobs }, 'Starting Bayt KSA browser scraper (Playwright)...');

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

      const listingLinks: { title: string; href: string }[] = [];

      // Extract genuine job vacancy cards only
      $('a[data-js-view="search-job-title"], h2.h5 a, li[data-js-job] a[href*="/jobs/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = this.cleanText($(el).text());

        // Skip non-job navigation links
        if (
          !href ||
          !title ||
          title.length < 5 ||
          href.includes('/locations/') ||
          href.includes('/countries/') ||
          href.includes('/cities/') ||
          href.includes('/roles/') ||
          href.includes('/industries/') ||
          href.includes('/salaries/') ||
          href.includes('/career-advice/') ||
          title.toLowerCase().startsWith('jobs in') ||
          title.toLowerCase().startsWith('countries hiring') ||
          title.toLowerCase().startsWith('executive jobs') ||
          title.toLowerCase().startsWith('work from home') ||
          title.toLowerCase().includes('find the job you love')
        ) {
          return;
        }

        // Genuine Bayt job URLs usually contain a numerical ID e.g. -5444639/ or /job/
        const isJobUrl = /\d+\/?$/.test(href) || href.includes('/job/');
        if (isJobUrl && !listingLinks.some((l) => l.href === href)) {
          listingLinks.push({ title, href });
        }
      });

      await indexCtx.close();
      logger.info({ found: listingLinks.length }, 'Found genuine Bayt job vacancy cards');

      for (const item of listingLinks) {
        if (jobs.length >= maxJobs) break;

        const rawUrl = item.href.startsWith('http') ? item.href : `https://www.bayt.com${item.href}`;
        const cleanUrl = rawUrl.replace('https://www.bayt.com/ar/', 'https://www.bayt.com/en/').split('?')[0];

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
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2500);

          const fullHtml = await page.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          $detail('script, style, iframe, header, footer, nav, .cookie-banner').remove();

          const pageTitle = $detail('h1').text().trim() || item.title;
          const company = this.cleanText($detail('.t-company, .company, [data-js-view="company-name"]').text()) || 'Saudi Employer';
          
          let location = 'Saudi Arabia';
          const locText = $detail('.t-location, [data-js-view="job-location"], .t-break').text();
          if (locText.includes('Riyadh')) location = 'Riyadh, Saudi Arabia';
          else if (locText.includes('Jeddah')) location = 'Jeddah, Saudi Arabia';
          else if (locText.includes('Dammam')) location = 'Dammam, Saudi Arabia';
          else if (locText.includes('Khobar')) location = 'Al Khobar, Saudi Arabia';
          else if (locText.includes('Mecca') || locText.includes('Makkah')) location = 'Mecca, Saudi Arabia';
          else if (locText.includes('Medina') || locText.includes('Madinah')) location = 'Medina, Saudi Arabia';

          const descEl = $detail('[data-js-view="job-description"], .t-break, #job_desc, .card-content');
          descEl.find('br').replaceWith('\n');
          descEl.find('p, div, li').each((_, el) => {
            $detail(el).append('\n');
          });

          let fullDescription = descEl.text()
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.includes('Apply now') && !l.includes('Email to Friend') && !l.includes('Report this job') && !l.includes('Promote your job'))
            .join('\n');

          if (!fullDescription || fullDescription.length < 30) {
            fullDescription = `${pageTitle} at ${company} in ${location}.`;
          }

          jobs.push({
            sourcePlatform: 'bayt',
            sourceUrl: cleanUrl,
            title: pageTitle,
            companyName: company,
            locationRaw: location,
            descriptionRaw: fullDescription,
            applyUrl: cleanUrl,
          });

          await this.sleep(400, 800);
        } catch (detailErr: any) {
          logger.info({ url: cleanUrl }, 'Could not load Bayt detail page, skipping');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error scraping Bayt KSA');
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'Bayt scraping completed');
    return jobs;
  }
}

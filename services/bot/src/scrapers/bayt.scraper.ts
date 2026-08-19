import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { isStrictlyInSaudiArabia } from '../utils/geo-validator.js';

export class BaytScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'bayt';

  /**
   * Scrapes Bayt.com KSA genuine job vacancies with short clean URLs and concise descriptions
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

      const listingLinks: { title: string; href: string; jobId: string }[] = [];

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

        // Extract numerical Job ID from URL
        const idMatch = href.match(/(\d+)\/?$/);
        if (idMatch && !listingLinks.some((l) => l.jobId === idMatch[1])) {
          listingLinks.push({ title, href, jobId: idMatch[1] });
        }
      });

      await indexCtx.close();
      logger.info({ found: listingLinks.length }, 'Found genuine Bayt job vacancy cards');

      for (const item of listingLinks) {
        if (jobs.length >= maxJobs) break;

        // Clean short URL without long percent-encoded Arabic strings
        const cleanShortUrl = `https://www.bayt.com/en/saudi-arabia/jobs/job-${item.jobId}/`;
        const rawUrl = item.href.startsWith('http') ? item.href : `https://www.bayt.com${item.href}`;

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
          await page.goto(cleanShortUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2500);

          const fullHtml = await page.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          $detail('script, style, iframe, header, footer, nav, .cookie-banner, .similar-jobs, #similar_jobs, form, button, [class*="action"], [class*="widget"]').remove();

          const pageTitle = $detail('h1').text().trim() || item.title;
          const company = this.cleanText($detail('.t-company, .company, [data-js-view="company-name"]').first().text()) || 'Saudi Employer';
          
          let location = 'Saudi Arabia';
          const locText = $detail('.t-location, [data-js-view="job-location"], .t-break').first().text();
          if (locText.includes('Riyadh')) location = 'Riyadh, Saudi Arabia';
          else if (locText.includes('Jeddah')) location = 'Jeddah, Saudi Arabia';
          else if (locText.includes('Dammam')) location = 'Dammam, Saudi Arabia';
          else if (locText.includes('Khobar')) location = 'Al Khobar, Saudi Arabia';
          else if (locText.includes('Mecca') || locText.includes('Makkah')) location = 'Mecca, Saudi Arabia';
          else if (locText.includes('Medina') || locText.includes('Madinah')) location = 'Medina, Saudi Arabia';

          // Extract single primary job description container (prevent duplicate concatenation)
          let descEl = $detail('[data-js-view="job-description"], #job_desc');
          if (descEl.length === 0) {
            descEl = $detail('.card-content, .t-break').first();
          }

          descEl.find('br').replaceWith('\n');
          descEl.find('p, div, li, h2, h3, h4, h5').each((_, el) => {
            $detail(el).append('\n');
          });

          // Deduplicate consecutive identical lines
          const seenLines = new Set<string>();
          const rawLines = descEl.text().split('\n').map((l) => l.trim()).filter(Boolean);
          const uniqueLines: string[] = [];

          for (const line of rawLines) {
            if (
              line.includes('Apply now') ||
              line.includes('Email to Friend') ||
              line.includes('Report this job') ||
              line.includes('Promote your job') ||
              line.includes('Are you looking for') ||
              line.includes('Similar jobs') ||
              line.includes('Attach a Cover Letter') ||
              line.includes('Send Me Similar Jobs') ||
              line.includes('Follow This Company') ||
              line.includes('Unfollow This Company') ||
              line.includes('Complete Questionnaire') ||
              line.includes('Print') ||
              line.includes('translated by AI')
            ) {
              continue;
            }

            if (!seenLines.has(line)) {
              seenLines.add(line);
              uniqueLines.push(line);
            }
          }

          let fullDescription = uniqueLines.join('\n').trim();
          if (!fullDescription || fullDescription.length < 30) {
            fullDescription = `${pageTitle} at ${company} in ${location}.`;
          }

          // Strict Geolocation check
          if (!isStrictlyInSaudiArabia({ url: cleanShortUrl, location, title: pageTitle, description: fullDescription })) {
            logger.warn({ title: pageTitle, location }, 'Skipping foreign non-KSA Bayt post');
            continue;
          }

          jobs.push({
            sourcePlatform: 'bayt',
            sourceUrl: cleanShortUrl,
            title: pageTitle,
            companyName: company,
            locationRaw: location,
            descriptionRaw: fullDescription,
            applyUrl: cleanShortUrl,
          });

          await this.sleep(400, 800);
        } catch (detailErr: any) {
          logger.info({ url: cleanShortUrl }, 'Could not load Bayt detail page, skipping');
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

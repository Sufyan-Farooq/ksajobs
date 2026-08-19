import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class ExpatriatesScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'expatriates';

  /**
   * Scrapes genuine 100% organic direct employer classified postings across major Saudi cities
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const searchUrls = [
      'https://www.expatriates.com/classifieds/riyadh/jobs/',
      'https://www.expatriates.com/classifieds/jeddah/jobs/',
      'https://www.expatriates.com/classifieds/eastern-province/jobs/',
      'https://www.expatriates.com/classifieds/saudi-arabia/jobs/',
    ];

    logger.info({ platform: this.platform, maxJobs }, 'Starting Expatriates KSA organic employer scraper...');

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

      const links: { title: string; href: string }[] = [];

      for (const listUrl of searchUrls) {
        if (links.length >= maxJobs * 2) break;

        try {
          const indexCtx = await browser.newContext({
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            locale: 'en-US',
          });
          await indexCtx.addInitScript(() => {
            delete (Object.getPrototypeOf(navigator) as any).webdriver;
          });

          const page = await indexCtx.newPage();
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await page.waitForTimeout(2000);

          const html = await page.content();
          await indexCtx.close();

          const $ = cheerio.load(html);

          // Extract direct classified listing links
          $('a[href*="/cls/"]').each((_, el) => {
            const linkEl = $(el);
            const title = this.cleanText(linkEl.text());
            const href = linkEl.attr('href');

            // Skip empty links or thumbnail containers
            if (
              href &&
              title &&
              title.length > 5 &&
              !title.includes('Page View Count') &&
              !title.includes('Never pay any kind') &&
              !links.some((l) => l.href === href)
            ) {
              links.push({ title, href });
            }
          });
        } catch (idxErr: any) {
          logger.warn({ url: listUrl, error: idxErr.message }, 'Failed to load Expatriates city index');
        }
      }

      logger.info({ count: links.length }, 'Found Expatriates Organic listings on page');

      for (const item of links) {
        if (jobs.length >= maxJobs) break;

        const cleanUrl = item.href.startsWith('http')
          ? item.href
          : `https://www.expatriates.com${item.href}`;

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

          // Extract Recruiter Email & Phone before script removal
          const rawHtml = $detail.html();
          let contactEmail: string | undefined;
          const emailMatch = rawHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch && !emailMatch[0].toLowerCase().includes('cloudflare') && !emailMatch[0].includes('example.com') && !emailMatch[0].includes('expatriates.com')) {
            contactEmail = emailMatch[0];
          }

          let contactPhone: string | undefined;
          const phoneMatch = rawHtml.match(/(?:\+966|00966|0)?5[0-9]{8}/);
          if (phoneMatch) {
            contactPhone = phoneMatch[0];
          }

          // Strip ALL scripts, styles, ads, and interactive buttons from DOM
          $detail('script, style, iframe, .adsbygoogle, ins, button, nav, header, footer, noscript').remove();

          const fullPageText = $detail('body').text();

          // Extract Region / City
          let location = 'Saudi Arabia';
          const regionMatch = fullPageText.match(/Region:\s*([^\n\r]+)/i);
          if (regionMatch) {
            location = regionMatch[1].trim();
          }

          // Extract clean pure post body
          let description = '';
          const postBodyEl = $detail('.post-body, .listing-body, .classified-body, div.post');
          if (postBodyEl.length > 0) {
            postBodyEl.find('a, button, form, .post-actions').remove();
            postBodyEl.find('br').replaceWith('\n');
            postBodyEl.find('p, div, li').each((_, el) => {
              $detail(el).append('\n');
            });
            const rawLines = postBodyEl.text().split('\n').map((l) => l.trim()).filter(Boolean);
            description = rawLines.join('\n');
          }

          if (!description || description.length < 20) {
            const startIdx = fullPageText.indexOf('Posting ID:');
            const endIdx = fullPageText.indexOf('Page View Count');
            if (startIdx !== -1 && endIdx !== -1) {
              const rawSlice = fullPageText.slice(startIdx, endIdx);
              description = rawSlice
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('Posting ID') && !l.includes('Chat on WhatsApp') && !l.includes('NEVER PAY ANY KIND OF FEE'))
                .join('\n');
            } else {
              description = item.title;
            }
          }

          // Strip JavaScript code blocks, obfuscated functions, and noise
          description = description
            .replace(/\(function\(\)\s*\{[\s\S]*?\}\)\(\);?/g, '')
            .replace(/var\s+\w+\s*=[\s\S]*?;/g, '')
            .replace(/\(adsbygoogle\s*=[\s\S]*?\);/g, '')
            .replace(/Finding Residential Apartment Rentals[\s\S]*?For Deals/gi, '')
            .replace(/Browsing Local s For Deals/gi, '')
            .replace(/Back\s*Next/gi, '')
            .replace(/Email to a Friend/gi, '')
            .replace(/Ask AI to Review This Ad/gi, '')
            .replace(/Problem with this ad\?/gi, '')
            .replace(/Miscategorized\s*Prohibited\s*Spam/gi, '')
            .replace(/Page View Count:\s*\d+/gi, '')
            .replace(/NEVER PAY ANY KIND OF FEE WHEN APPLYING FOR A JOB\./gi, '')
            .trim();

          jobs.push({
            sourcePlatform: 'expatriates',
            sourceUrl: cleanUrl,
            title: item.title,
            companyName: 'Direct Employer / Classified',
            locationRaw: location,
            descriptionRaw: description || item.title,
            contactEmail,
            contactPhone,
            applyUrl: cleanUrl,
          });

          await this.sleep(300, 600);
        } catch (detailErr: any) {
          logger.info({ url: cleanUrl }, 'Could not load Expatriates post, skipping');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error scraping Expatriates KSA');
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'Expatriates Organic scraping completed');
    return jobs;
  }
}

import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class ExpatriatesScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'expatriates';

  /**
   * Scrapes Expatriates.com KSA classifieds - STRICTLY ORGANIC / DIRECT EMPLOYER POSTS (Excludes sponsored/featured/premium ads)
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/';

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
      await indexPage.waitForTimeout(3500);

      const html = await indexPage.content();
      const $ = cheerio.load(html);

      const links: { title: string; href: string }[] = [];

      // Extract STRICTLY Organic / Direct employer listings (EXCLUDE sponsored / featured / premium)
      $('li').each((_, el) => {
        const item = $(el);
        const isPremium = item.attr('premium')?.toLowerCase() === 'true';
        const isSponsoredText = item.find('.epoch').text().trim().toLowerCase().includes('sponsored');
        const isBanner = item.find('.banner').length > 0;

        // 🛑 STRICT EXCLUSION: Skip all sponsored / featured / premium posts
        if (isPremium || isSponsoredText || isBanner) {
          return;
        }

        const linkEl = item.find('a[href*="/cls/"]').first();
        const title = this.cleanText(linkEl.text());
        const href = linkEl.attr('href');
        if (href && title && title.length > 4 && !links.some((l) => l.href === href)) {
          links.push({ title, href });
        }
      });

      await indexCtx.close();
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
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          await page.waitForTimeout(4000);

          const fullHtml = await page.content();
          await detailCtx.close();

          const $detail = cheerio.load(fullHtml);
          const fullPageText = $detail('body').text();

          // Extract Region / City
          let location = 'Saudi Arabia';
          const regionMatch = fullPageText.match(/Region:\s*([^\n\r]+)/i);
          if (regionMatch) {
            location = regionMatch[1].trim();
          }

          // Extract Recruiter Email
          let contactEmail: string | undefined;
          const emailMatch = fullPageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch && !emailMatch[0].toLowerCase().includes('cloudflare') && !emailMatch[0].includes('example.com')) {
            contactEmail = emailMatch[0];
          }

          // Extract Recruiter Phone / WhatsApp
          let contactPhone: string | undefined;
          const phoneMatch = fullPageText.match(/(?:\+966|00966|0)?5[0-9]{8}/);
          if (phoneMatch) {
            contactPhone = phoneMatch[0];
          }

          // Extract clean pure post body preserving original line breaks
          $detail('script, style, iframe, .adsbygoogle, ins, button, nav, header, footer').remove();

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

          // Clean website noise from description
          description = description
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
            companyName: contactEmail ? contactEmail.split('@')[0].toUpperCase() : 'Direct Employer',
            locationRaw: location,
            descriptionRaw: description || item.title,
            applyUrl: cleanUrl,
            contactEmail,
            contactPhone,
          });

          await this.sleep(300, 600);
        } catch (detailErr: any) {
          logger.warn({ error: detailErr.message, url: cleanUrl }, 'Could not load detail page');
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error in Expatriates browser scraper');
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    logger.info({ platform: this.platform, count: jobs.length }, 'Expatriates Organic scraping completed');
    return jobs;
  }
}

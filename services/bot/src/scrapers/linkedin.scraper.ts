import { BaseScraper, logger } from './base.scraper.js';
import type { RawScrapedJob, SourcePlatform } from '@ksajobs/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { isStrictlyInSaudiArabia } from '../utils/geo-validator.js';

export class LinkedInScraper extends BaseScraper {
  readonly platform: SourcePlatform = 'linkedin';

  /**
   * Scrapes genuine LinkedIn KSA jobs using official Saudi Arabia geoId 100459316
   */
  async scrape(maxJobs: number = 10): Promise<RawScrapedJob[]> {
    const jobs: RawScrapedJob[] = [];
    const url = 'https://www.linkedin.com/jobs/search?location=Saudi%20Arabia&geoId=100459316&f_TPR=r86400&position=1&pageNum=0';

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
        locale: 'en-US',
      });
      await context.addInitScript(() => {
        delete (Object.getPrototypeOf(navigator) as any).webdriver;
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(3000);

      // Auto-scroll to load cards
      await page.evaluate(async () => {
        window.scrollBy(0, 800);
      });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const cards: { title: string; company: string; location: string; link: string; time?: string }[] = [];

      $('.base-search-card, .job-search-card').each((_, el) => {
        const card = $(el);
        const titleEl = card.find('.base-search-card__title, h3');
        const title = this.cleanText(titleEl.text());
        const company = this.cleanText(card.find('.base-search-card__subtitle, .job-card-container__primary-description').text());
        const location = this.cleanText(card.find('.job-search-card__location').text());
        const link = card.find('a.base-card__full-link, a.job-card-container__link').attr('href');
        const time = card.find('time').attr('datetime') || card.find('time').text().trim();

        // Skip generic badge titles or non-job cards
        const lowerTitle = (title || '').toLowerCase();
        if (
          !title ||
          !link ||
          lowerTitle === 'full time' ||
          lowerTitle === 'part time' ||
          lowerTitle === 'contract' ||
          lowerTitle === 'on-site' ||
          lowerTitle === 'remote' ||
          lowerTitle === 'hybrid' ||
          title.length < 4
        ) {
          return;
        }

        // Strict Geolocation check on card URL and Location
        if (!isStrictlyInSaudiArabia({ url: link, location, title })) {
          return;
        }

        if (!cards.some((c) => c.link === link)) {
          cards.push({ title, company, location, link, time });
        }
      });

      logger.info({ count: cards.length }, 'Found genuine LinkedIn KSA listing cards');

      for (const card of cards) {
        if (jobs.length >= maxJobs) break;

        const cleanUrl = card.link.split('?')[0];
        let fullDescription = `${card.title} at ${card.company || 'Saudi Employer'} in ${card.location || 'Saudi Arabia'}.`;
        let pageTitle = card.title;
        let company = card.company || 'Saudi Employer';
        let location = card.location || 'Saudi Arabia';

        try {
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(1800);

          const fullHtml = await page.content();
          const $detail = cheerio.load(fullHtml);
          $detail('script, style, header, footer, nav, iframe, .similar-jobs, .job-alert-form').remove();

          const detailTitle = $detail('h1.topcard__title, h1.top-card-layout__title, h1').text().trim();
          if (detailTitle && detailTitle.length > 4 && !detailTitle.toLowerCase().includes('full time')) {
            pageTitle = detailTitle;
          }

          const detailCompany = this.cleanText($detail('.topcard__flavor--black-link, .topcard__flavor, [data-tracking-control-name="public_jobs_topcard-org-name"]').first().text());
          if (detailCompany) company = detailCompany;

          const topLocation = this.cleanText($detail('.top-card-layout__first-subline .topcard__flavor:nth-child(2), .topcard__flavor--bullet').text());
          if (topLocation) {
            location = topLocation;
          }

          const descEl = $detail('.show-more-less-html__markup, .description__text, section.show-more-less-html');
          descEl.find('br').replaceWith('\n');
          descEl.find('p, div, li, h2, h3, h4').each((_, el) => {
            $detail(el).append('\n');
          });

          let extractedText = descEl.text()
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => {
              if (!l) return false;
              if (l === 'Show more' || l === 'Show less') return false;
              if (l.startsWith('Referrals increase your chances')) return false;
              if (l.startsWith('See more jobs like this')) return false;
              if (l.startsWith('Sign in to set job alert')) return false;
              return true;
            })
            .join('\n');

          // Clean LinkedIn noise
          extractedText = extractedText
            .replace(/Show\s*more/gi, '')
            .replace(/Show\s*less/gi, '')
            .replace(/Referrals increase your chances of interviewing at[\s\S]*?\./gi, '')
            .trim();

          if (extractedText && extractedText.length > 50) {
            fullDescription = extractedText;
          }
        } catch (detailErr: any) {
          logger.info({ url: cleanUrl }, 'Using fallback listing card details for LinkedIn post');
        }

        // Strict Geolocation Verification on Full Detail
        if (!isStrictlyInSaudiArabia({ url: cleanUrl, location, title: pageTitle, description: fullDescription })) {
          logger.warn({ title: pageTitle, location, url: cleanUrl }, 'Skipping foreign non-KSA LinkedIn post');
          continue;
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

        await this.sleep(800, 1500);
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

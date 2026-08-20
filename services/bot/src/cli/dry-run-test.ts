import dotenv from 'dotenv';
dotenv.config();

import { LinkedInScraper } from '../scrapers/linkedin.scraper.js';
import { BaytScraper } from '../scrapers/bayt.scraper.js';
import { TanqeebScraper } from '../scrapers/tanqeeb.scraper.js';
import { ExpatriatesScraper } from '../scrapers/expatriates.scraper.js';
import { GeminiJobParser } from '../ai/gemini.service.js';
import { isStrictlyInSaudiArabia } from '../utils/geo-validator.js';
import type { RawScrapedJob } from '@ksajobs/types';

async function runDryRunAudit() {
  console.log('\n======================================================');
  console.log('🧪 KSA JOBS - COMPREHENSIVE PRODUCTION DRY RUN AUDIT');
  console.log('======================================================\n');

  const parser = new GeminiJobParser();
  const scrapers = [
    { name: 'LinkedIn', instance: new LinkedInScraper() },
    { name: 'Bayt', instance: new BaytScraper() },
    { name: 'Tanqeeb', instance: new TanqeebScraper() },
    { name: 'Expatriates', instance: new ExpatriatesScraper() },
  ];

  const results: Record<string, { scraped: number; validKsa: number; samplePost?: any }> = {};

  for (const s of scrapers) {
    console.log(`\n🔍 [1/4] Testing ${s.name} Scraper (Target: 2 real jobs)...`);
    try {
      const rawJobs = await s.instance.scrape(2);
      console.log(`   ➔ Scraped ${rawJobs.length} raw listings from ${s.name}`);

      let validCount = 0;
      let firstParsed = null;

      for (const raw of rawJobs) {
        const isKsa = isStrictlyInSaudiArabia({
          url: raw.sourceUrl,
          location: raw.locationRaw,
          title: raw.title,
          description: raw.descriptionRaw,
        });

        if (isKsa) {
          validCount++;
          if (!firstParsed) {
            console.log(`   🤖 Enriching sample job with AI: "${raw.title}"...`);
            firstParsed = await parser.parse(raw);
          }
        } else {
          console.warn(`   ⚠️ Filtered out non-KSA posting: "${raw.title}" (${raw.locationRaw})`);
        }
      }

      results[s.name] = {
        scraped: rawJobs.length,
        validKsa: validCount,
        samplePost: firstParsed,
      };
    } catch (e: any) {
      console.error(`   ❌ Error testing ${s.name}:`, e.message);
      results[s.name] = { scraped: 0, validKsa: 0 };
    }
  }

  console.log('\n======================================================');
  console.log('📋 AUDIT RESULTS & SAMPLE WHATSAPP BROADCAST POSTS:');
  console.log('======================================================\n');

  for (const [platform, data] of Object.entries(results)) {
    console.log(`\n------------------------------------------------------`);
    console.log(`🎯 Platform: ${platform.toUpperCase()}`);
    console.log(`📊 Scraped: ${data.scraped} | Valid KSA: ${data.validKsa}`);
    if (data.samplePost) {
      console.log(`📌 Title (En): ${data.samplePost.titleEn}`);
      console.log(`📍 City (En): ${data.samplePost.cityEn}`);
      console.log(`🇸🇦 Saudization: ${data.samplePost.saudization}`);
      console.log(`🔗 Apply Link: ${data.samplePost.applyUrl}`);
      console.log(`📱 WhatsApp Broadcast Post Length: ${data.samplePost.whatsappMessageText?.length || 0} chars`);
      console.log(`\n--- WHATSAPP MESSAGE PREVIEW ---`);
      console.log(data.samplePost.whatsappMessageText);
      console.log(`--------------------------------`);
    } else {
      console.log(`⚠️ No valid sample post generated.`);
    }
  }

  console.log('\n======================================================');
  console.log('✅ DRY RUN AUDIT COMPLETED');
  console.log('======================================================\n');
}

runDryRunAudit().catch((err) => {
  console.error('Fatal dry run error:', err);
  process.exit(1);
});

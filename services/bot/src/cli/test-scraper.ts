import dotenv from 'dotenv';
dotenv.config();

import { scrapers, runScraper, runAllScrapers } from '../scrapers/index.js';
import { GeminiJobParser } from '../ai/gemini.service.js';
import type { SourcePlatform } from '@ksajobs/types';

async function main() {
  const args = process.argv.slice(2);
  const platformIndex = args.indexOf('--platform');
  const platform = (platformIndex !== -1 ? args[platformIndex + 1] : 'linkedin') as SourcePlatform | 'all';
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 3;

  console.log(`\n======================================================`);
  console.log(`🔎 Testing KSA Job Scraper & AI Parser Pipeline`);
  console.log(`🎯 Target Platform: ${platform.toUpperCase()}`);
  console.log(`📊 Max Jobs: ${limit}`);
  console.log(`======================================================\n`);

  const parser = new GeminiJobParser();

  let rawJobs = [];
  if (platform === 'all') {
    rawJobs = await runAllScrapers(limit);
  } else {
    rawJobs = await runScraper(platform, limit);
  }

  console.log(`\n✅ Scraped ${rawJobs.length} raw jobs.\n`);

  for (let i = 0; i < rawJobs.length; i++) {
    const raw = rawJobs[i];
    console.log(`------------------------------------------------------`);
    console.log(`📌 Raw Job #${i + 1}:`);
    console.log(`Title: ${raw.title}`);
    console.log(`Company: ${raw.companyName}`);
    console.log(`Location: ${raw.locationRaw}`);
    console.log(`Apply URL: ${raw.applyUrl}`);
    console.log(`Platform: ${raw.sourcePlatform}`);
    if (raw.contactPhone) console.log(`Phone: ${raw.contactPhone}`);
    if (raw.contactEmail) console.log(`Email: ${raw.contactEmail}`);

    console.log(`\n🤖 Parsing via Gemini AI...`);
    const parsed = await parser.parse(raw);

    console.log(`\n✨ AI Enriched Result:`);
    console.log(`• English Title: ${parsed.titleEn}`);
    console.log(`• Arabic Title: ${parsed.titleAr}`);
    console.log(`• City: ${parsed.cityAr} (${parsed.cityEn})`);
    console.log(`• Saudization: ${parsed.saudizationLabelAr} (${parsed.saudization})`);
    console.log(`• Category: ${parsed.categoryAr} (${parsed.category})`);
    console.log(`• Work Type: ${parsed.workType}`);

    console.log(`\n📱 Generated WhatsApp Broadcast Preview:`);
    console.log(`------------------------------------------------------`);
    console.log(parsed.whatsappMessageText);
    console.log(`------------------------------------------------------\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});

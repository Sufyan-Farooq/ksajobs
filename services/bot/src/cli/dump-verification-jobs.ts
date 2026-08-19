import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { ExpatriatesScraper } from '../scrapers/expatriates.scraper.js';
import { BaytScraper } from '../scrapers/bayt.scraper.js';
import { TanqeebScraper } from '../scrapers/tanqeeb.scraper.js';
import { LinkedInScraper } from '../scrapers/linkedin.scraper.js';
import { GeminiJobParser } from '../ai/gemini.service.js';
import type { RawScrapedJob, ParsedJobData } from '@ksajobs/types';

interface VerificationJobEntry {
  platform: string;
  index: number;
  raw: RawScrapedJob;
  parsed: ParsedJobData;
}

async function runDump() {
  console.log('===========================================================');
  console.log('🔍 RUNNING COMPREHENSIVE MULTI-SOURCE JOB SCRAPING SWEEP');
  console.log('===========================================================\n');

  const parser = new GeminiJobParser();
  const allResults: VerificationJobEntry[] = [];

  const scrapers = [
    { name: 'EXPATRIATES.COM', instance: new ExpatriatesScraper(), limit: 5 },
    { name: 'BAYT.COM', instance: new BaytScraper(), limit: 5 },
    { name: 'TANQEEB.COM', instance: new TanqeebScraper(), limit: 5 },
    { name: 'LINKEDIN', instance: new LinkedInScraper(), limit: 5 },
  ];

  for (const scraperInfo of scrapers) {
    console.log(`\n⏳ Scraping from [${scraperInfo.name}] (Target: ${scraperInfo.limit} jobs)...`);
    try {
      const rawJobs = await scraperInfo.instance.scrape(scraperInfo.limit);
      console.log(`✅ Scraped ${rawJobs.length} raw jobs from ${scraperInfo.name}`);

      for (let i = 0; i < rawJobs.length; i++) {
        const raw = rawJobs[i];
        console.log(`   [${scraperInfo.name} #${i + 1}] Parsing: "${raw.title}" (${raw.locationRaw})...`);
        const parsed = await parser.parse(raw);

        allResults.push({
          platform: raw.sourcePlatform,
          index: i + 1,
          raw,
          parsed,
        });
      }
    } catch (err: any) {
      console.error(`❌ Error scraping ${scraperInfo.name}:`, err.message);
    }
  }

  console.log('\n===========================================================');
  console.log(`📊 TOTAL SCRAPED & VERIFIED JOBS: ${allResults.length}`);
  console.log('===========================================================\n');

  // 1. Generate JSON Dump
  const rootDir = path.resolve(process.cwd(), '../../');
  const jsonPath = path.join(rootDir, 'VERIFICATION_JOBS_DUMP.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`📁 Saved JSON dump to: ${jsonPath}`);

  // 2. Generate Beautiful Markdown Dump
  const mdPath = path.join(rootDir, 'VERIFICATION_JOBS_DUMP.md');
  let mdContent = `# 📋 KSA Jobs — Multi-Source Verification Dump Report
Generated on: ${new Date().toISOString()}
Total Jobs Scraped & Enriched: **${allResults.length}**

---

## 📌 Summary by Source Platform
${scrapers
  .map(
    (s) =>
      `* **${s.name}**: ${allResults.filter((j) => j.platform.toLowerCase() === s.instance.platform.toLowerCase()).length} verified jobs`
  )
  .join('\n')}

---

`;

  for (const item of allResults) {
    mdContent += `## [${item.platform.toUpperCase()} #${item.index}] ${item.parsed.titleEn}
* **Company**: ${item.parsed.companyName || item.raw.companyName}
* **Original Title**: ${item.raw.title}
* **Scraped Location**: ${item.raw.locationRaw}
* **Target City**: ${item.parsed.cityEn} (${item.parsed.cityAr})
* **Work Type / Job Type**: ${item.parsed.workType} / ${item.parsed.jobType}
* **Saudization Status**: ${item.parsed.saudization} (${item.parsed.saudizationLabelAr})
* **Source Apply URL**: [${item.raw.applyUrl}](${item.raw.applyUrl})
* **Direct Contact Email**: ${item.raw.contactEmail || item.parsed.contactEmail || 'N/A (Apply via Link)'}
* **Direct Contact Phone / WhatsApp**: ${item.raw.contactPhone || item.parsed.contactPhone || 'N/A (Apply via Link)'}

### 📝 Formatted Description & Overview:
${item.parsed.descriptionFormatted}

### 🎯 Key Requirements:
${(item.parsed.requirements || []).map((r) => `- ${r}`).join('\n') || '- None specified'}

### 📱 Generated WhatsApp Broadcast Preview:
\`\`\`text
${item.parsed.whatsappMessageText}
\`\`\`

---

`;
  }

  fs.writeFileSync(mdPath, mdContent, 'utf-8');
  console.log(`📁 Saved Markdown report to: ${mdPath}`);
  console.log('\n🎉 Multi-source verification dump complete!');
}

runDump().catch(console.error);

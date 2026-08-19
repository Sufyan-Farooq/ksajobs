import dotenv from 'dotenv';
dotenv.config();

import { GmailCVIngestionWorker } from '../cv/gmail-ingestion.worker.js';

async function main() {
  const args = process.argv.slice(2);
  const scanAll = args.includes('--all') || args.includes('-a');
  const limitIndex = args.indexOf('--limit');
  const maxEmails = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : (scanAll ? 100 : 30);

  console.log(`\n======================================================`);
  console.log(`📧 KSA Jobs - Gmail CV & Resume Ingestion Scanner`);
  console.log(`👤 User: ${process.env.GMAIL_USER || 'Not configured in .env'}`);
  console.log(`🔄 Mode: ${scanAll ? 'Historical Scan (All Past Emails)' : 'Unread Emails Only'}`);
  console.log(`📊 Max Emails to Scan: ${maxEmails}`);
  console.log(`======================================================\n`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('❌ Error: GMAIL_USER and GMAIL_APP_PASSWORD must be configured in .env');
    console.log('\n📖 How to setup Gmail App Password in 60 seconds:');
    console.log('1. Go to: https://myaccount.google.com/security');
    console.log('2. Ensure 2-Step Verification is ON');
    console.log('3. Visit: https://myaccount.google.com/apppasswords');
    console.log('4. Name: "KSA Jobs" -> Click Create -> Copy 16-character password');
    console.log('5. Add to .env:');
    console.log('   GMAIL_USER="your-email@gmail.com"');
    console.log('   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"\n');
    process.exit(1);
  }

  const worker = new GmailCVIngestionWorker();
  const results = await worker.scanInbox({
    scanAllHistory: scanAll,
    maxEmails,
  });

  console.log(`\n======================================================`);
  console.log(`🏁 Scan Summary:`);
  console.log(`✅ Candidates Ingested & Verified: ${results.processed}`);
  console.log(`🔁 Duplicates Skipped: ${results.skipped}`);
  console.log(`⚠️ Errors: ${results.errors}`);
  console.log(`======================================================\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal Scan Error:', err);
  process.exit(1);
});

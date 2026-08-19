import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { CVSecurityScanner } from './security-scanner.js';
import { AICVParser } from './cv-parser.js';
import { prisma } from '@ksajobs/database';
import { logger } from '../scrapers/base.scraper.js';

export interface GmailScanOptions {
  scanAllHistory?: boolean;
  maxEmails?: number;
  sinceDate?: Date;
}

export class GmailCVIngestionWorker {
  private parser: AICVParser;
  private user?: string;
  private pass?: string;
  private uploadsDir: string;

  constructor() {
    this.parser = new AICVParser();
    this.user = process.env.GMAIL_USER;
    this.pass = process.env.GMAIL_APP_PASSWORD;

    // Direct path to apps/web/public/uploads/resumes
    this.uploadsDir = path.resolve(process.cwd(), '../../apps/web/public/uploads/resumes');
    if (!fs.existsSync(this.uploadsDir)) {
      // Fallback relative path check
      this.uploadsDir = path.resolve(process.cwd(), 'apps/web/public/uploads/resumes');
      if (!fs.existsSync(this.uploadsDir)) {
        this.uploadsDir = path.resolve(process.cwd(), '../web/public/uploads/resumes');
      }
    }

    try {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    } catch (e) {}
  }

  /**
   * Scans Gmail inbox for resumes (both historical and new unread emails) and saves attached CV files
   */
  async scanInbox(options: GmailScanOptions = {}): Promise<{ processed: number; skipped: number; errors: number }> {
    if (!this.user || !this.pass) {
      logger.warn('GMAIL_USER or GMAIL_APP_PASSWORD not set. Skipping Gmail CV scan.');
      return { processed: 0, skipped: 0, errors: 0 };
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: this.user,
        pass: this.pass.replace(/\s+/g, ''),
      },
      logger: false,
    });

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    try {
      logger.info({ user: this.user, scanAll: !!options.scanAllHistory }, 'Connecting to Gmail IMAP...');
      await client.connect();

      const lock = await client.getMailboxLock('INBOX');

      try {
        let searchQuery: any = options.scanAllHistory ? { all: true } : { seen: false };
        if (options.sinceDate) {
          searchQuery = { since: options.sinceDate };
        }

        const maxEmails = options.maxEmails || (options.scanAllHistory ? 150 : 30);
        logger.info({ maxEmails, query: searchQuery }, 'Searching Gmail messages for CVs/Resumes...');

        const searchResult = await client.search(searchQuery);
        const messages: number[] = Array.isArray(searchResult) ? searchResult : [];
        logger.info({ totalFound: messages.length }, 'Found matching emails in Gmail inbox');

        const targetIds = messages.slice(-maxEmails);

        for (const seq of targetIds) {
          try {
            const rawMessage = await client.download(seq.toString());
            if (!rawMessage || !rawMessage.content) continue;

            const parsedMail = await simpleParser(rawMessage.content);
            const subject = parsedMail.subject || 'No Subject';
            const senderEmail = parsedMail.from?.value[0]?.address || 'unknown@sender.com';
            const senderName = parsedMail.from?.value[0]?.name || '';

            logger.info({ subject, senderEmail }, 'Analyzing incoming email for CV attachments...');

            const attachments = parsedMail.attachments || [];
            let foundValidResume = false;

            for (const att of attachments) {
              const rawFileName = att.filename || 'resume.pdf';
              const fileBuffer = att.content;

              // 1. Security & Magic Byte Inspection
              const scanResult = CVSecurityScanner.scanBuffer(rawFileName, fileBuffer);

              if (!scanResult.isSafe) {
                logger.warn({ rawFileName, reasons: scanResult.reasons }, '⚠️ Attachment blocked by security scanner');
                continue;
              }

              // 2. Save Attached CV file to disk
              const fileTimestamp = Date.now();
              const uniqueFileName = `${fileTimestamp}-${scanResult.sanitizedFileName}`;
              const filePath = path.join(this.uploadsDir, uniqueFileName);
              
              try {
                fs.mkdirSync(this.uploadsDir, { recursive: true });
                fs.writeFileSync(filePath, fileBuffer);
              } catch (fsErr: any) {
                logger.warn({ error: fsErr.message }, 'Could not save CV file to disk');
              }

              const resumeUrl = `/uploads/resumes/${uniqueFileName}`;

              // 3. Extract Text from PDF/Doc
              let extractedText = '';
              if (scanResult.fileType === 'pdf') {
                try {
                  const pdfFunction: any = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || pdfParse;
                  const pdfData = await pdfFunction(fileBuffer);
                  extractedText = pdfData?.text || '';
                } catch (pdfErr: any) {
                  logger.warn({ rawFileName, error: pdfErr.message }, 'PDF text extraction fallback');
                }
              }

              if (!extractedText || extractedText.trim().length < 50) {
                extractedText = parsedMail.text || subject;
              }

              // 4. Deduplication Check
              const existing = await prisma.candidate.findFirst({
                where: {
                  OR: [
                    { email: senderEmail },
                    { resumeFileName: scanResult.sanitizedFileName },
                  ],
                },
              });

              if (existing) {
                logger.info({ senderEmail, rawFileName }, 'Candidate already ingested, updating CV attachment...');
                await prisma.candidate.update({
                  where: { id: existing.id },
                  data: {
                    resumeUrl,
                    resumeFileName: scanResult.sanitizedFileName,
                  },
                });
                skipped++;
                foundValidResume = true;
                break;
              }

              // 5. Parse with Gemini AI
              logger.info({ rawFileName, senderEmail }, '🤖 Parsing Candidate Profile with Gemini AI...');
              const profile = await this.parser.parseCVText(extractedText, subject, senderEmail);

              // 6. Save Candidate with Attached CV URL to Neon Database
              await prisma.candidate.create({
                data: {
                  name: profile.name || senderName || 'Candidate',
                  email: profile.email || senderEmail,
                  phone: profile.phone,
                  city: profile.city,
                  nationality: profile.nationality,
                  currentRole: profile.currentRole,
                  experienceYears: profile.experienceYears,
                  education: profile.education,
                  skills: JSON.stringify(profile.skills || []),
                  summary: profile.summary,
                  resumeFileName: scanResult.sanitizedFileName,
                  resumeUrl,
                  safetyScanStatus: 'CLEAN',
                  source: 'gmail_cv',
                  emailSubject: subject,
                  emailSender: senderEmail,
                },
              });

              processed++;
              foundValidResume = true;
              logger.info(
                { name: profile.name, role: profile.currentRole, resumeUrl },
                '✅ Candidate added with attached CV file!'
              );
              break;
            }

            if (!foundValidResume && (subject.toLowerCase().includes('cv') || subject.toLowerCase().includes('resume') || subject.toLowerCase().includes('job'))) {
              const bodyText = parsedMail.text || '';
              if (bodyText.length > 50) {
                const existing = await prisma.candidate.findFirst({ where: { email: senderEmail } });
                if (!existing) {
                  const profile = await this.parser.parseCVText(bodyText, subject, senderEmail);
                  await prisma.candidate.create({
                    data: {
                      name: profile.name || senderName || 'Candidate',
                      email: profile.email || senderEmail,
                      phone: profile.phone,
                      city: profile.city,
                      currentRole: profile.currentRole,
                      skills: JSON.stringify(profile.skills || []),
                      summary: profile.summary,
                      safetyScanStatus: 'CLEAN',
                      source: 'gmail_cv',
                      emailSubject: subject,
                      emailSender: senderEmail,
                    },
                  });
                  processed++;
                }
              }
            }
          } catch (msgErr: any) {
            logger.error({ error: msgErr.message }, 'Error processing individual Gmail message');
            errors++;
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (connErr: any) {
      logger.error({ error: connErr.message }, 'Failed to connect to Gmail via IMAP');
      errors++;
    }

    logger.info({ processed, skipped, errors }, '🏁 Gmail CV scan cycle completed.');
    return { processed, skipped, errors };
  }
}

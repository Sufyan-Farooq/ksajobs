import { GoogleGenAI } from '@google/genai';
import type { RawScrapedJob, ParsedJobData } from '@ksajobs/types';
import { KSA_JOB_EXTRACTION_SYSTEM_PROMPT, KSA_JOBS_SIGNATURE } from './prompts.js';
import { logger } from '../scrapers/base.scraper.js';

export class GeminiJobParser {
  private ai: GoogleGenAI | null = null;
  private primaryModel: string;
  private lastCallTimestamp: number = 0;
  private readonly minSpacingMs: number = 4200; // Strict 4.2s spacing to stay <= 14 RPM (beneath 15 RPM limit)

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      logger.warn('GEMINI_API_KEY not found in environment variables. Running in heuristic mode.');
    }
  }

  /**
   * Enforces strict rate-limit spacing before making an AI request
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTimestamp;
    if (elapsed < this.minSpacingMs) {
      const waitTime = this.minSpacingMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastCallTimestamp = Date.now();
  }

  /**
   * Cleans, translates (Arabic -> English), and concisely summarizes for WhatsApp
   */
  async parse(rawJob: RawScrapedJob): Promise<ParsedJobData> {
    const cleanedRawDescription = this.cleanWebsiteNoise(rawJob.descriptionRaw);

    if (!this.ai) {
      return this.heuristicFallback({ ...rawJob, descriptionRaw: cleanedRawDescription });
    }

    const prompt = `
Translate (if in Arabic) and CONCISELY SUMMARIZE this job posting into professional English for WhatsApp:

TITLE: ${rawJob.title}
COMPANY: ${rawJob.companyName}
LOCATION: ${rawJob.locationRaw}
CONTACT EMAIL: ${rawJob.contactEmail || 'N/A'}
CONTACT PHONE: ${rawJob.contactPhone || 'N/A'}
APPLY URL: ${rawJob.applyUrl}

RAW POST CONTENT:
${cleanedRawDescription}

Generate strict JSON:
{
  "titleEn": "Clean English Title (Translated from Arabic if original is Arabic)",
  "titleAr": "Original Arabic Title (or Arabic translation)",
  "cityEn": "Riyadh / Jeddah / Dammam / Khobar / etc. or Saudi Arabia",
  "cityAr": "الرياض / جدة / الدمام / الخبر / السعودية",
  "workType": "ONSITE" | "REMOTE" | "HYBRID",
  "jobType": "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP",
  "saudization": "SAUDI_ONLY" | "EXPATS_ALLOWED" | "SAUDIS_PREFERRED" | "NOT_SPECIFIED",
  "saudizationLabelAr": "سعوديين فقط / متاح للمقيمين / الأفضلية للسعوديين / متاح للجميع",
  "salaryMin": number or null,
  "salaryMax": number or null,
  "salaryCurrency": "SAR",
  "experienceYearsMin": number or null,
  "experienceYearsMax": number or null,
  "educationLevel": "Bachelor / Diploma / High School / etc.",
  "category": "General / Engineering / IT / Sales / Healthcare / Logistics / Hospitality",
  "categoryAr": "عام / هندسة / تقنية المعلومات / مبيعات / رعاية صحية / لوجستيات / ضيافة",
  "descriptionFormatted": "Concise summary of the job in English (overview + key duties + requirements)",
  "requirements": ["Exact requirement 1 in English", "Exact requirement 2 in English"],
  "benefits": ["Benefit 1 in English"],
  "skills": ["Skill 1 in English"],
  "whatsappMessageText": "The concise English WhatsApp formatted post under 150 words with organized highlights, WhatsApp contact info, and signature"
}
`;

    // Attempt AI call with built-in throttler & retry on 429
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.throttle();

        const response = await this.ai.models.generateContent({
          model: this.primaryModel,
          contents: prompt,
          config: {
            systemInstruction: KSA_JOB_EXTRACTION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text?.trim() || '{}';
        const cleanedJson = this.sanitizeJsonString(rawText);
        const parsed = JSON.parse(cleanedJson);

        const contactEmail = rawJob.contactEmail || parsed.contactEmail || this.extractEmail(cleanedRawDescription) || null;
        const contactPhone = rawJob.contactPhone || parsed.contactPhone || this.extractPhone(cleanedRawDescription) || null;

        return {
          titleEn: parsed.titleEn || this.translateArabicTerms(rawJob.title),
          titleAr: parsed.titleAr || rawJob.title,
          companyName: rawJob.companyName,
          companyLogo: rawJob.companyLogo,
          cityEn: parsed.cityEn || this.normalizeCity(rawJob.locationRaw),
          cityAr: parsed.cityAr || 'السعودية',
          workType: parsed.workType || 'ONSITE',
          jobType: parsed.jobType || 'FULL_TIME',
          saudization: parsed.saudization || 'NOT_SPECIFIED',
          saudizationLabelAr: parsed.saudizationLabelAr || 'متاح للجميع',
          salaryMin: parsed.salaryMin || null,
          salaryMax: parsed.salaryMax || null,
          salaryCurrency: parsed.salaryCurrency || 'SAR',
          experienceYearsMin: parsed.experienceYearsMin || null,
          experienceYearsMax: parsed.experienceYearsMax || null,
          educationLevel: parsed.educationLevel || undefined,
          category: parsed.category || 'General',
          categoryAr: parsed.categoryAr || 'عام',
          descriptionFormatted: parsed.descriptionFormatted || this.summarizeConcise(cleanedRawDescription),
          requirements: Array.isArray(parsed.requirements) ? parsed.requirements : this.extractRequirements(cleanedRawDescription),
          benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          contactEmail,
          contactPhone,
          applyUrl: rawJob.applyUrl,
          whatsappMessageText: parsed.whatsappMessageText || this.generateDefaultWhatsAppText(rawJob, parsed, contactEmail, contactPhone, cleanedRawDescription),
        };
      } catch (err: any) {
        const isRateLimit = err?.message?.includes('429') || err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
        if (isRateLimit && attempt === 1) {
          logger.info({ title: rawJob.title }, 'Gemini rate-limited, cooling down for 6s before retry...');
          await new Promise((r) => setTimeout(r, 6000));
          continue;
        }

        // Graceful silent fallback
        logger.info({ title: rawJob.title }, 'Applied instant concise translation & template');
        return this.heuristicFallback({ ...rawJob, descriptionRaw: cleanedRawDescription });
      }
    }

    return this.heuristicFallback({ ...rawJob, descriptionRaw: cleanedRawDescription });
  }

  private cleanWebsiteNoise(text: string): string {
    if (!text) return '';
    const noisePatterns = [
      /\(function\(\)\s*\{[\s\S]*?\}\)\(\);?/g,
      /var\s+\w+\s*=[\s\S]*?;/g,
      /\(adsbygoogle\s*=[\s\S]*?\);?/g,
      /document\.getElementById[\s\S]*?;/g,
      /Finding Residential Apartment Rentals[\s\S]*?For Deals/gi,
      /Browsing Local s For Deals/gi,
      /Tanqeeb\.com[\s\S]*?for you in one place\./gi,
      /Tanqeeb\.com\s*is the pioneering search engine[\s\S]*?post your job openings on Tanqeeb\./gi,
      /Join Tanqeeb today and explore[\s\S]*?post your job openings on Tanqeeb\./gi,
      /Tanqeeb\.com\s*is the pioneering search engine/gi,
      /Join Tanqeeb today and explore the latest job openings from top companies\./gi,
      /Create an employer account and easily post your job openings on Tanqeeb\./gi,
      /Create an employer account/gi,
      /Join and Discover More/gi,
      /Discover More Opportunities/gi,
      /Looking to Hire\?/gi,
      /Start Hiring/gi,
      /Show Arabic translation/gi,
      /Show English translation/gi,
      /Attach a Cover Letter/gi,
      /Send Me Similar Jobs/gi,
      /Follow This Company/gi,
      /Unfollow This Company/gi,
      /Complete Questionnaire/gi,
      /This job post has been translated by AI[\s\S]*?errors\./gi,
      /Print/gi,
      /Calculating Freight Shipping Rates/gi,
      /Expat Relocation Services/gi,
      /Expat Resources/gi,
      /classified ad/gi,
      /Ask AI to Review This Ad/gi,
      /Problem with this ad\?/gi,
      /Miscategorized Prohibited Spam/gi,
      /Back Next/gi,
      /Email to a Friend/gi,
      /Arabs & Middle Easterners/gi,
      /Expat Community Forum/gi,
      /Discover more/gi,
      /When applying mention/gi,
      /Place an Ad/gi,
      /Home Subscribe/gi,
      /expatriates\.com/gi,
      /Posting ID:\s*\d+/gi,
      /Page View Count:\s*\d+/gi,
      /NEVER PAY ANY KIND OF FEE WHEN APPLYING FOR A JOB\./gi,
    ];

    let cleaned = text;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Deduplicate repetitive lines
    const seen = new Set<string>();
    const lines = cleaned.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('Jobs') && l !== 'jobs');
    const unique: string[] = [];

    for (const l of lines) {
      if (!seen.has(l)) {
        seen.add(l);
        unique.push(l);
      }
    }

    return unique.join('\n');
  }

  private summarizeConcise(text: string): string {
    const translated = this.translateArabicTerms(text);
    const lines = translated.split('\n').map((l) => l.trim()).filter(Boolean);
    
    if (lines.length <= 6) return lines.join('\n');

    // Filter out boilerplate and company PR essays
    const usefulLines: string[] = [];
    let charCount = 0;

    for (const line of lines) {
      if (charCount > 650) break;
      if (
        line.startsWith('Initiative by') ||
        line.startsWith('Channel Link') ||
        line.startsWith('Group Link') ||
        line.includes('http') ||
        line.includes('Be the change') ||
        line.includes('visionary developer')
      ) {
        continue;
      }

      usefulLines.push(line);
      charCount += line.length;
    }

    return usefulLines.slice(0, 8).join('\n');
  }

  private translateArabicTerms(text: string): string {
    if (!text) return '';
    if (!/[\u0600-\u06FF]/.test(text)) return text;

    let out = text;
    // Compound phrases & multi-word expressions matched FIRST to prevent substring corruption
    const dictionary: [RegExp, string][] = [
      [/المسؤوليات الأساسية:/g, 'Key Responsibilities: / Accountabilities:'],
      [/المسؤوليات الرئيسية:/g, 'Main Responsibilities:'],
      [/المهام والمسؤوليات:/g, 'Key Tasks & Responsibilities:'],
      [/هدف الوظيفة:|هدف الJob \/ Position::/g, 'Job Purpose / Objective:'],
      [/التعليم والخبرة المطلوبة:/g, 'Required Education and Experience:'],
      [/التعليم والخبرة:/g, 'Education and Experience:'],
      [/الخبرة المطلوبة:/g, 'Required Experience:'],
      [/المهارات المطلوبة:/g, 'Required Skills:'],
      [/المؤهلات المطلوبة:|المؤهلات المطلوبة/g, 'Required Qualifications:'],
      [/الشروط المطلوبة:/g, 'Required Conditions:'],
      [/طبيعة العمل:/g, 'Job Nature:'],
      [/التخصص:/g, 'Specialty:'],
      [/موقع العمل:/g, 'Job Location:'],
      [/مكان العمل:/g, 'Work Location:'],
      [/الدوام:/g, 'Working Hours:'],
      [/المنطقة الشرقية/g, 'Eastern Province'],
      [/الأحساء/g, 'Al Ahsa'],
      [/نقل كفالة/g, 'Transfer of Sponsorship'],
      [/إقامة سارية وقابلة للنقل/g, 'Valid Transferable Iqama'],
      [/إقامة سارية/g, 'Valid Transferable Iqama'],
      [/ساعات العمل:/g, 'Working Hours:'],
      [/من 8 صباحًا إلى 5 مساءً/g, '8:00 AM – 5:00 PM'],
      [/التواصل وإرسال السيرة الذاتية عبر الواتساب أو البريد الإلكتروني فقط/g, 'Send CV & inquiries via WhatsApp or Email only (no calls)'],
      [/إرسال السيرة الذاتية/g, 'Send CV'],
      [/مشغل رافعة شوكية|مشغل رافعات/g, 'Forklift Operator'],
      [/رافعة شوكية|رافعات شوكية/g, 'Forklift'],
      [/فني تركيب تكييف/g, 'AC Installation Technician'],
      [/فني تكييف/g, 'AC Technician'],
      [/فني تركيب/g, 'Installation Technician'],
      [/فني صيانة/g, 'Maintenance Technician'],
      [/متخصص في أعمال تركيب وتنفيذ أنظمة/g, 'specialized in installation & execution of systems'],
      [/وليس صيانة/g, '(installation only, not maintenance)'],
      [/تركيب وتنفيذ فقط/g, 'Installation & Execution Only'],
      [/مهندس موقع مدني أول/g, 'Senior Site Civil Engineer'],
      [/مهندس مدني/g, 'Civil Engineer'],
      [/مهندس معماري/g, 'Architectural Engineer'],
      [/مهندس كهرباء/g, 'Electrical Engineer'],
      [/مهندس ميكانيكا/g, 'Mechanical Engineer'],
      [/مندوب مبيعات/g, 'Sales Representative'],
      [/مسؤول مبيعات/g, 'Sales Executive'],
      [/مدير مبيعات/g, 'Sales Manager'],
      [/مدير مشروع/g, 'Project Manager'],
      [/مدير فندق/g, 'Hotel Director'],
      [/سائق شاحنة/g, 'Truck Driver'],
      [/سائقين شاحنات/g, 'Truck Drivers'],
      [/سائق خاص/g, 'Private Family Driver'],
      [/كهربائي شاحنات/g, 'Truck Auto Electrician'],
      [/ميكانيكي ديزل/g, 'Diesel Mechanic'],
      [/عامل بوفيه/g, 'Cafeteria / Buffet Helper'],
      [/عامل نظافة/g, 'Cleaner / Helper'],
      [/وظيفة قيم ماستر \(Game Master\) - مشرف الالعاب في مركز كيوز الترفيهي/g, 'Game Master - Games Supervisor at Quez Entertainment Center'],
      [/قيم ماستر/g, 'Game Master'],
      [/مشرف الالعاب/g, 'Games Supervisor'],
      [/مساعد إداري|مساعد ادارى/g, 'Administrative Assistant'],
      [/مدخل بيانات/g, 'Data Entry Clerk'],
      [/قهوجي/g, 'Hospitality Coffee Server (Qahwaji)'],
      [/نحتاج قهوجي/g, 'We need a Hospitality Coffee Server (Qahwaji)'],
      [/مقدم قهوة/g, 'Coffee Server'],
      [/توظيف فوري/g, 'Immediate Hiring'],
      [/الكهربائية/g, 'Electrical'],
      [/كهربائي/g, 'Electrician'],
      [/ميكانيكي/g, 'Mechanic'],
      [/محاسب/g, 'Accountant'],
      [/سائق/g, 'Driver'],
      [/وظيفة/g, 'Job / Position:'],
      [/الرياض/g, 'Riyadh'],
      [/جدة/g, 'Jeddah'],
      [/الدمام/g, 'Dammam'],
      [/الخبر(?![a-zA-Z\u0600-\u06FF])/g, 'Al Khobar'],
      [/مكة/g, 'Mecca'],
      [/المدينة/g, 'Medina'],
      [/المملكة العربية السعودية/g, 'Saudi Arabia'],
      [/السعودية/g, 'Saudi Arabia'],
      [/المطلوبة/g, 'Required'],
      [/مطلوب/g, 'Required / Hiring:'],
      [/الخبرة/g, 'Experience'],
      [/خبرة/g, 'Experience'],
      [/الراتب/g, 'Salary'],
      [/راتب/g, 'Salary'],
      [/ملاحظة:/g, 'Note:'],
    ];

    for (const [pattern, replacement] of dictionary) {
      out = out.replace(pattern, replacement);
    }
    return out;
  }

  private sanitizeJsonString(jsonStr: string): string {
    let clean = jsonStr.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean.replace(/[\u0000-\u001F]+/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });
  }

  private extractEmail(text: string): string | null {
    const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return m ? m[0] : null;
  }

  private extractPhone(text: string): string | null {
    const m = text.match(/(?:\+966|00966|0)?5[0-9]{8}/);
    return m ? m[0] : null;
  }

  private extractRequirements(text: string): string[] {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'));
    if (lines.length > 0) return lines.slice(0, 8).map((l) => this.translateArabicTerms(l.replace(/^[•\-*]\s*/, '')));
    return [];
  }

  private normalizeCity(rawLocation: string): string {
    const loc = rawLocation.toLowerCase();
    if (loc.includes('riyadh') || loc.includes('الرياض')) return 'Riyadh';
    if (loc.includes('jeddah') || loc.includes('جدة')) return 'Jeddah';
    if (loc.includes('dammam') || loc.includes('الدمام')) return 'Dammam';
    if (loc.includes('khobar') || loc.includes('الخبر')) return 'Al Khobar';
    if (loc.includes('ahsa') || loc.includes('الأحساء')) return 'Al Ahsa';
    if (loc.includes('neom') || loc.includes('نيوم')) return 'NEOM';
    if (loc.includes('mecca') || loc.includes('makkah') || loc.includes('مكة')) return 'Mecca';
    if (loc.includes('medina') || loc.includes('madinah') || loc.includes('المدينة')) return 'Medina';
    if (loc.includes('jubail') || loc.includes('الجبيل')) return 'Jubail';
    return 'Saudi Arabia';
  }

  private generateDefaultWhatsAppText(
    raw: RawScrapedJob,
    enriched: any,
    contactEmail?: string | null,
    contactPhone?: string | null,
    cleanedBody?: string
  ): string {
    const city = enriched.cityEn || this.normalizeCity(raw.locationRaw);
    const title = enriched.titleEn || this.translateArabicTerms(raw.title);

    const applyLines: string[] = [];
    if (contactEmail) {
      applyLines.push(`📧 Send CV / Email:\n${contactEmail}`);
    }
    if (contactPhone) {
      const cleanDigits = contactPhone.replace(/[^0-9]/g, '');
      const waNumber = cleanDigits.startsWith('966')
        ? cleanDigits
        : cleanDigits.startsWith('0')
        ? '966' + cleanDigits.slice(1)
        : '966' + cleanDigits;
      applyLines.push(`💬 WhatsApp:\nhttps://wa.me/${waNumber}`);
    }
    applyLines.push(`🔗 Apply Link:\n${raw.applyUrl}`);

    const conciseBody = this.summarizeConcise(cleanedBody || raw.descriptionRaw);

    return `📢 ${title}

📍 Location: ${city}, Saudi Arabia

${conciseBody}

${applyLines.join('\n\n')}

${KSA_JOBS_SIGNATURE}`;
  }

  private heuristicFallback(rawJob: RawScrapedJob): ParsedJobData {
    const cityEn = this.normalizeCity(rawJob.locationRaw);
    const contactEmail = rawJob.contactEmail || this.extractEmail(rawJob.descriptionRaw) || null;
    const contactPhone = rawJob.contactPhone || this.extractPhone(rawJob.descriptionRaw) || null;
    const titleEn = this.translateArabicTerms(rawJob.title);
    const descriptionFormatted = this.summarizeConcise(rawJob.descriptionRaw);

    return {
      titleEn,
      titleAr: rawJob.title,
      companyName: rawJob.companyName,
      companyLogo: rawJob.companyLogo,
      cityEn,
      cityAr: cityEn === 'Riyadh' ? 'الرياض' : cityEn === 'Jeddah' ? 'جدة' : 'السعودية',
      workType: 'ONSITE',
      jobType: 'FULL_TIME',
      saudization: 'NOT_SPECIFIED',
      saudizationLabelAr: 'متاح للجميع',
      category: 'General',
      categoryAr: 'عام',
      salaryCurrency: 'SAR',
      descriptionFormatted,
      requirements: this.extractRequirements(rawJob.descriptionRaw),
      benefits: [],
      skills: [],
      contactEmail,
      contactPhone,
      applyUrl: rawJob.applyUrl,
      whatsappMessageText: this.generateDefaultWhatsAppText(rawJob, { titleEn, cityEn }, contactEmail, contactPhone, rawJob.descriptionRaw),
    };
  }
}

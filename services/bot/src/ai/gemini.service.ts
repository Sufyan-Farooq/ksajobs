import { GoogleGenAI } from '@google/genai';
import type { RawScrapedJob, ParsedJobData } from '@ksajobs/types';
import { KSA_JOB_EXTRACTION_SYSTEM_PROMPT, KSA_JOBS_SIGNATURE } from './prompts.js';
import { logger } from '../scrapers/base.scraper.js';

export class GeminiJobParser {
  private ai: GoogleGenAI | null = null;
  private primaryModel: string;

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
   * Cleans, translates (Arabic -> English), and organizes authentic employer details
   */
  async parse(rawJob: RawScrapedJob): Promise<ParsedJobData> {
    const cleanedRawDescription = this.cleanWebsiteNoise(rawJob.descriptionRaw);

    if (!this.ai) {
      return this.heuristicFallback({ ...rawJob, descriptionRaw: cleanedRawDescription });
    }

    const prompt = `
Translate (if in Arabic) and organize this job posting cleanly into English using ONLY the details listed in the post:

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
  "descriptionFormatted": "The organized English post description (translated from Arabic if original was Arabic)",
  "requirements": ["Exact requirement 1 in English", "Exact requirement 2 in English"],
  "benefits": ["Benefit 1 in English"],
  "skills": ["Skill 1 in English"],
  "whatsappMessageText": "The complete English WhatsApp formatted post with organized translated authentic details, WhatsApp contact info (no calling mentioned), and signature"
}
`;

    try {
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
        descriptionFormatted: parsed.descriptionFormatted || this.translateArabicTerms(cleanedRawDescription),
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : this.extractRequirements(cleanedRawDescription),
        benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        contactEmail,
        contactPhone,
        applyUrl: rawJob.applyUrl,
        whatsappMessageText: parsed.whatsappMessageText || this.generateDefaultWhatsAppText(rawJob, parsed, contactEmail, contactPhone, cleanedRawDescription),
      };
    } catch (err: any) {
      // Quiet fallback on rate limits or API hiccups
      return this.heuristicFallback({ ...rawJob, descriptionRaw: cleanedRawDescription });
    }
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
      /Tanqeeb\.com\s*is the pioneering search engine[\s\S]*?post your job openings on Tanqeeb\./gi,
      /Join Tanqeeb today and explore[\s\S]*?post your job openings on Tanqeeb\./gi,
      /Tanqeeb\.com\s*is the pioneering search engine/gi,
      /Join Tanqeeb today/gi,
      /Create an employer account/gi,
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

    return cleaned
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('Jobs') && l !== 'jobs')
      .join('\n');
  }

  private translateArabicTerms(text: string): string {
    if (!text) return '';
    if (!/[\u0600-\u06FF]/.test(text)) return text;

    let out = text;
    const dictionary: [RegExp, string][] = [
      [/قهوجي/g, 'Hospitality Coffee Server (Qahwaji)'],
      [/نحتاج قهوجي/g, 'We need a Hospitality Coffee Server (Qahwaji)'],
      [/مقدم قهوة/g, 'Coffee Server'],
      [/سائق شاحنة/g, 'Truck Driver'],
      [/سائقين شاحنات/g, 'Truck Drivers'],
      [/كهربائي شاحنات/g, 'Truck Auto Electrician'],
      [/كهربائي/g, 'Electrician'],
      [/ميكانيكي ديزل/g, 'Diesel Mechanic'],
      [/ميكانيكي/g, 'Mechanic'],
      [/عامل بوفيه/g, 'Cafeteria / Buffet Helper'],
      [/عامل نظافة/g, 'Cleaner / Helper'],
      [/نقل كفالة/g, 'Transfer of Sponsorship'],
      [/وظيفة قيم ماستر \(Game Master\) - مشرف الالعاب في مركز كيوز الترفيهي/g, 'Game Master - Games Supervisor at Quez Entertainment Center'],
      [/وظيفة/g, 'Job / Position:'],
      [/قيم ماستر/g, 'Game Master'],
      [/مشرف الالعاب/g, 'Games Supervisor'],
      [/مساعد ادارى/g, 'Administrative Assistant'],
      [/مساعد إداري/g, 'Administrative Assistant'],
      [/مدخل بيانات/g, 'Data Entry Clerk'],
      [/توظيف فوري/g, 'Immediate Hiring'],
      [/مطلوب/g, 'Required / Hiring'],
      [/فني تركيب تكييف/g, 'AC Installation Technician'],
      [/فني تكييف/g, 'AC Technician'],
      [/فني تركيب/g, 'Installation Technician'],
      [/فني صيانة/g, 'Maintenance Technician'],
      [/متخصص في أعمال تركيب وتنفيذ أنظمة/g, 'specialized in installation & execution of systems'],
      [/وليس صيانة/g, '(installation only, not maintenance)'],
      [/تركيب وتنفيذ فقط/g, 'Installation & Execution Only'],
      [/في آر في/g, 'VRV'],
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
      [/محاسب/g, 'Accountant'],
      [/سائق/g, 'Driver'],
      [/سائق خاص/g, 'Private Family Driver'],
      [/طبيعة العمل:/g, 'Job Nature:'],
      [/التخصص:/g, 'Specialty:'],
      [/موقع العمل:/g, 'Job Location:'],
      [/مكان العمل:/g, 'Work Location:'],
      [/المنطقة الشرقية/g, 'Eastern Province'],
      [/الأحساء/g, 'Al Ahsa'],
      [/الدوام:/g, 'Working Hours:'],
      [/من 8 صباحًا إلى 5 مساءً/g, '8:00 AM – 5:00 PM'],
      [/الرياض/g, 'Riyadh'],
      [/جدة/g, 'Jeddah'],
      [/الدمام/g, 'Dammam'],
      [/الخبر/g, 'Al Khobar'],
      [/مكة/g, 'Mecca'],
      [/المدينة/g, 'Medina'],
      [/المملكة العربية السعودية/g, 'Saudi Arabia'],
      [/السعودية/g, 'Saudi Arabia'],
      [/ملاحظة:/g, 'Note:'],
      [/التواصل وإرسال السيرة الذاتية عبر الواتساب أو البريد الإلكتروني فقط/g, 'Send CV & inquiries via WhatsApp or Email only (no calls)'],
      [/إرسال السيرة الذاتية/g, 'Send CV'],
      [/خبرة/g, 'Experience'],
      [/راتب/g, 'Salary'],
      [/إقامة سارية/g, 'Valid Transferable Iqama'],
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

    const rawTextToTranslate = (cleanedBody || raw.descriptionRaw).trim();
    const bodyText = this.translateArabicTerms(rawTextToTranslate);

    return `📢 ${title}

📍 Location: ${city}, Saudi Arabia

${bodyText}

${applyLines.join('\n\n')}

${KSA_JOBS_SIGNATURE}`;
  }

  private heuristicFallback(rawJob: RawScrapedJob): ParsedJobData {
    const cityEn = this.normalizeCity(rawJob.locationRaw);
    const contactEmail = rawJob.contactEmail || this.extractEmail(rawJob.descriptionRaw) || null;
    const contactPhone = rawJob.contactPhone || this.extractPhone(rawJob.descriptionRaw) || null;
    const titleEn = this.translateArabicTerms(rawJob.title);
    const descriptionFormatted = this.translateArabicTerms(rawJob.descriptionRaw);

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

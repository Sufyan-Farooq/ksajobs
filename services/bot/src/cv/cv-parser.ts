import { GoogleGenAI } from '@google/genai';
import { logger } from '../scrapers/base.scraper.js';

export interface ParsedCandidateProfile {
  name: string;
  email: string;
  phone?: string;
  city: string;
  nationality?: string;
  currentRole: string;
  experienceYears?: number;
  education?: string;
  skills: string[];
  summary: string;
}

export class AICVParser {
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Extracts structured Candidate profile from raw CV text
   */
  async parseCVText(rawText: string, emailSubject?: string, senderEmail?: string): Promise<ParsedCandidateProfile> {
    if (this.ai) {
      try {
        const prompt = `
Extract structured candidate profile information from this resume/CV for the Saudi Arabia job market.

EMAIL SUBJECT: ${emailSubject || 'N/A'}
SENDER: ${senderEmail || 'N/A'}
RESUME RAW TEXT:
${rawText.slice(0, 10000)}

Return a strict JSON object matching this schema (IN ENGLISH):
{
  "name": "Candidate Full Name",
  "email": "candidate email address",
  "phone": "phone number with country code if available",
  "city": "Riyadh/Jeddah/Dammam/Khobar/etc. or Saudi Arabia",
  "nationality": "Saudi / Indian / Pakistani / Egyptian / Filipino / etc. or null",
  "currentRole": "Primary Job Title / Professional Specialization (e.g. Civil Engineer, Accountant, Flutter Developer)",
  "experienceYears": number or null,
  "education": "Highest Degree (e.g. Bachelor of Computer Science)",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "summary": "3-4 sentence professional executive summary highlighting key strengths, career achievements, and Iqama status if mentioned"
}

Return ONLY valid JSON.
`;

        const response = await this.ai.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        let text = response.text?.trim() || '{}';
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(text);
        return {
          name: parsed.name || 'Candidate',
          email: parsed.email || senderEmail || 'no-email@candidate.com',
          phone: parsed.phone || undefined,
          city: parsed.city || 'Riyadh',
          nationality: parsed.nationality || undefined,
          currentRole: parsed.currentRole || 'Professional',
          experienceYears: typeof parsed.experienceYears === 'number' ? parsed.experienceYears : undefined,
          education: parsed.education || undefined,
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          summary: parsed.summary || 'Experienced professional looking for opportunities in Saudi Arabia.',
        };
      } catch (err: any) {
        logger.error({ error: err.message }, 'Gemini CV parser failed, using fallback regex parser');
      }
    }

    return this.fallbackRegexParse(rawText, emailSubject, senderEmail);
  }

  private fallbackRegexParse(text: string, subject?: string, sender?: string): ParsedCandidateProfile {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+966|00966|0)?5[0-9]{8}/);

    let city = 'Riyadh';
    if (/jeddah|جدة/i.test(text)) city = 'Jeddah';
    else if (/dammam|الدمام/i.test(text)) city = 'Dammam';
    else if (/khobar|الخبر/i.test(text)) city = 'Al Khobar';

    return {
      name: subject?.replace(/cv|resume|application|job/gi, '').trim() || 'Candidate',
      email: emailMatch ? emailMatch[0] : sender || 'candidate@ksajobs.app',
      phone: phoneMatch ? phoneMatch[0] : undefined,
      city,
      currentRole: subject || 'Professional Candidate',
      skills: ['Professional Skills', 'Communication'],
      summary: 'Candidate submitted resume for Saudi Arabia job opportunities.',
    };
  }
}

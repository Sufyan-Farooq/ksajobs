export type JobStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type SaudizationStatus =
  | 'SAUDI_ONLY'       // سعوديين فقط
  | 'EXPATS_ALLOWED'   // متاح للمقيمين
  | 'SAUDIS_PREFERRED' // الأفضلية للسعوديين
  | 'NOT_SPECIFIED';   // غير محدد

export type WorkType = 'ONSITE' | 'REMOTE' | 'HYBRID';

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export type SourcePlatform =
  | 'linkedin'
  | 'bayt'
  | 'tanqeeb'
  | 'expatriates'
  | 'mourjan'
  | 'indeed'
  | 'manual';

export interface RawScrapedJob {
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  sourceJobId?: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  locationRaw: string;
  descriptionRaw: string;
  applyUrl: string;
  postedDateRaw?: string;
  contactEmail?: string;
  contactPhone?: string;
  salaryRaw?: string;
  employmentTypeRaw?: string;
}

export interface ParsedJobData {
  titleEn: string;
  titleAr: string;
  companyName: string;
  companyLogo?: string;
  cityEn: string;
  cityAr: string;
  workType: WorkType;
  jobType: JobType;
  saudization: SaudizationStatus;
  saudizationLabelAr: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  experienceYearsMin?: number | null;
  experienceYearsMax?: number | null;
  educationLevel?: string;
  category: string;
  categoryAr: string;
  descriptionFormatted: string;
  requirements: string[];
  benefits: string[];
  skills: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  applyUrl: string;
  whatsappMessageText: string;
}

export interface JobEntity extends ParsedJobData {
  id: string;
  slug: string;
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  descriptionRaw: string;
  status: JobStatus;
  discordMessageId?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  viewsCount: number;
  clicksCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

export interface WhatsAppGroupConfig {
  id: string;
  name: string;
  jid: string;
  cityFilter?: string | null;
  categoryFilter?: string | null;
  isActive: boolean;
}

export interface ScraperStats {
  platform: SourcePlatform;
  jobsFound: number;
  jobsInserted: number;
  jobsDuplicates: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

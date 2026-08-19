import { PrismaClient } from '@prisma/client';
import type { ParsedJobData, RawScrapedJob } from '@ksajobs/types';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Generates an SEO friendly unique slug for a job
 */
export function generateSlug(title: string, city: string = 'ksa'): string {
  const base = `${title}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36).slice(-5);
  return `${base}-${suffix}`;
}

/**
 * Executes a database operation with automatic retry on transient Neon serverless wakeups
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err.message?.includes('terminating connection') ||
        err.message?.includes('closed the connection') ||
        err.message?.includes('Can\'t reach database server') ||
        err.code === 'P1001' ||
        err.code === 'P1017';

      if (isTransient && i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const jobRepository = {
  async existsBySourceUrl(sourceUrl: string): Promise<boolean> {
    return withDbRetry(async () => {
      const count = await prisma.job.count({ where: { sourceUrl } });
      return count > 0;
    });
  },

  async createPendingJob(rawJob: RawScrapedJob, parsed: ParsedJobData) {
    return withDbRetry(async () => {
      const slug = generateSlug(parsed.titleEn || rawJob.title, parsed.cityEn || 'ksa');

      return prisma.job.create({
        data: {
          slug,
          titleEn: parsed.titleEn,
          titleAr: parsed.titleAr,
          companyName: parsed.companyName || rawJob.companyName,
          companyLogo: parsed.companyLogo || rawJob.companyLogo,
          cityEn: parsed.cityEn,
          cityAr: parsed.cityAr,
          workType: parsed.workType,
          jobType: parsed.jobType,
          saudization: parsed.saudization,
          saudizationLabelAr: parsed.saudizationLabelAr,
          salaryMin: parsed.salaryMin,
          salaryMax: parsed.salaryMax,
          salaryCurrency: parsed.salaryCurrency || 'SAR',
          experienceYearsMin: parsed.experienceYearsMin,
          experienceYearsMax: parsed.experienceYearsMax,
          educationLevel: parsed.educationLevel,
          category: parsed.category,
          categoryAr: parsed.categoryAr,
          descriptionRaw: rawJob.descriptionRaw,
          descriptionFormatted: parsed.descriptionFormatted,
          requirements: JSON.stringify(parsed.requirements || []),
          benefits: JSON.stringify(parsed.benefits || []),
          skills: JSON.stringify(parsed.skills || []),
          sourcePlatform: rawJob.sourcePlatform,
          sourceUrl: rawJob.sourceUrl,
          sourceJobId: rawJob.sourceJobId,
          contactEmail: parsed.contactEmail || rawJob.contactEmail,
          contactPhone: parsed.contactPhone || rawJob.contactPhone,
          applyUrl: rawJob.applyUrl,
          whatsappMessageText: parsed.whatsappMessageText,
          status: 'PENDING_APPROVAL',
        },
      });
    });
  },

  async setDiscordMessageId(id: string, discordMessageId: string) {
    return withDbRetry(() =>
      prisma.job.update({
        where: { id },
        data: { discordMessageId },
      })
    );
  },

  async approveJob(id: string, approvedBy: string) {
    return withDbRetry(() =>
      prisma.job.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
        },
      })
    );
  },

  async rejectJob(id: string, reason?: string) {
    return withDbRetry(() =>
      prisma.job.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason || 'Rejected by moderator',
        },
      })
    );
  },

  async findPublishedJobs(options: {
    searchQuery?: string;
    city?: string;
    saudization?: string;
    workType?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 15;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'APPROVED',
    };

    if (options.city && options.city !== 'all') {
      where.cityEn = { contains: options.city, mode: 'insensitive' };
    }

    if (options.saudization && options.saudization !== 'all') {
      where.saudization = options.saudization;
    }

    if (options.workType && options.workType !== 'all') {
      where.workType = options.workType;
    }

    if (options.category && options.category !== 'all') {
      where.category = options.category;
    }

    if (options.searchQuery) {
      where.OR = [
        { titleEn: { contains: options.searchQuery, mode: 'insensitive' } },
        { titleAr: { contains: options.searchQuery, mode: 'insensitive' } },
        { companyName: { contains: options.searchQuery, mode: 'insensitive' } },
        { descriptionRaw: { contains: options.searchQuery, mode: 'insensitive' } },
      ];
    }

    return withDbRetry(async () => {
      const [items, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.job.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    });
  },

  async findBySlug(slug: string) {
    return withDbRetry(() =>
      prisma.job.findUnique({
        where: { slug },
      })
    );
  },

  async findPendingJobs() {
    return withDbRetry(() =>
      prisma.job.findMany({
        where: { status: 'PENDING_APPROVAL' },
        orderBy: { createdAt: 'desc' },
      })
    );
  },
};

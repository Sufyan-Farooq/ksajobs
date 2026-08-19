import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  Banknote,
  Share2,
  ExternalLink,
  Mail,
  Phone,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { jobRepository } from '@ksajobs/database';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await jobRepository.findBySlug(slug);

  if (!job) {
    return { title: 'Job Not Found | KSA Jobs' };
  }

  const title = `${job.titleEn || job.titleAr} at ${job.companyName} (${job.cityEn}) - KSA Jobs`;
  const description = `${job.titleEn || job.titleAr} opening at ${job.companyName} in ${job.cityEn}, Saudi Arabia. Apply now on KSA Jobs.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await jobRepository.findBySlug(slug);

  if (!job) {
    return notFound();
  }

  // Parse JSON arrays safely
  let requirements: string[] = [];
  let benefits: string[] = [];
  let skills: string[] = [];
  try {
    requirements = JSON.parse(job.requirements || '[]');
    benefits = JSON.parse(job.benefits || '[]');
    skills = JSON.parse(job.skills || '[]');
  } catch (e) {}

  // Google Jobs Schema.org JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.titleEn || job.titleAr,
    description: job.descriptionFormatted || job.descriptionRaw,
    datePosted: new Date(job.createdAt).toISOString(),
    employmentType: job.jobType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
      logo: job.companyLogo || undefined,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.cityEn,
        addressCountry: 'SA',
      },
    },
    baseSalary:
      job.salaryMin && job.salaryMax
        ? {
            '@type': 'MonetaryAmount',
            currency: job.salaryCurrency || 'SAR',
            value: {
              '@type': 'QuantitativeValue',
              minValue: job.salaryMin,
              maxValue: job.salaryMax,
              unitText: 'MONTH',
            },
          }
        : undefined,
  };

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    job.whatsappMessageText ||
      `📢 ${job.titleEn || job.titleAr} at ${job.companyName} (${job.cityEn})\n🔗 Apply here: https://ksajobs.app/jobs/${job.slug}`
  )}`;

  const isSaudiOnly = job.saudization === 'SAUDI_ONLY';
  const isExpats = job.saudization === 'EXPATS_ALLOWED';
  const saudizationBadge = isSaudiOnly
    ? 'Saudi Nationals Only 🇸🇦'
    : isExpats
    ? 'Open to All Nationalities 🌐'
    : 'Open / Not Specified';

  return (
    <>
      {/* Structured Data Script for Google Jobs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Jobs</span>
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl flex-shrink-0 overflow-hidden">
                {job.companyLogo ? (
                  <img src={job.companyLogo} alt={job.companyName} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {saudizationBadge}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {job.workType === 'REMOTE' ? 'Remote 🏠' : job.workType === 'HYBRID' ? 'Hybrid 🏢' : 'Onsite 📍'}
                  </span>
                  <span className="text-[11px] uppercase font-bold text-slate-400">
                    Source: {job.sourcePlatform}
                  </span>
                </div>

                <h1 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
                  {job.titleEn || job.titleAr}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{job.companyName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{job.cityEn}, Saudi Arabia</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(job.createdAt).toLocaleDateString('en-US')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex sm:flex-col items-stretch gap-2.5 w-full sm:w-56">
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] text-center"
              >
                <span>Apply for this Job</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all"
              >
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Share on WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-slate-400 text-xs mb-1">Expected Salary</p>
              <p className="text-emerald-700 font-bold text-sm">
                {job.salaryMin && job.salaryMax
                  ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()} SAR`
                  : 'Not specified'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-slate-400 text-xs mb-1">Required Experience</p>
              <p className="text-slate-800 font-bold text-sm">
                {job.experienceYearsMin ? `${job.experienceYearsMin}+ years` : 'Open'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-slate-400 text-xs mb-1">Sector / Category</p>
              <p className="text-slate-800 font-bold text-sm">{job.category}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-slate-400 text-xs mb-1">Employment Type</p>
              <p className="text-slate-800 font-bold text-sm">
                {job.jobType === 'FULL_TIME' ? 'Full Time' : 'Part Time'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
          {/* Formatted Description */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>Job Overview</span>
            </h2>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
              {job.descriptionFormatted || job.descriptionRaw}
            </div>
          </div>

          {/* Requirements */}
          {requirements.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Requirements &amp; Qualifications</span>
              </h2>
              <ul className="space-y-2.5">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Benefits &amp; Perks</span>
              </h2>
              <ul className="space-y-2.5">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Tags */}
          {skills.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Key Skills:</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Direct Contact Info if available */}
          {(job.contactEmail || job.contactPhone) && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-2">
              <h3 className="text-sm font-bold text-emerald-900">Direct Application Contacts:</h3>
              <div className="flex flex-wrap gap-4 text-xs text-emerald-800">
                {job.contactEmail && (
                  <a href={`mailto:${job.contactEmail}`} className="flex items-center gap-1.5 hover:underline font-semibold">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>{job.contactEmail}</span>
                  </a>
                )}
                {job.contactPhone && (
                  <a href={`tel:${job.contactPhone}`} className="flex items-center gap-1.5 hover:underline font-semibold font-mono">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>{job.contactPhone}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

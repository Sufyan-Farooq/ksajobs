'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Building2,
  Share2,
  ExternalLink,
  Banknote,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface JobCardProps {
  job: {
    id: string;
    slug: string;
    titleEn: string;
    titleAr?: string | null;
    companyName: string;
    companyLogo?: string | null;
    cityEn: string;
    cityAr?: string | null;
    workType: string;
    jobType: string;
    saudization: string;
    saudizationLabelAr?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string;
    category: string;
    categoryAr?: string | null;
    sourcePlatform: string;
    applyUrl: string;
    whatsappMessageText?: string;
    createdAt: string | Date;
  };
}

export default function JobCard({ job }: JobCardProps) {
  const { lang, t } = useLanguage();
  const isSaudiOnly = job.saudization === 'SAUDI_ONLY';
  const isExpats = job.saudization === 'EXPATS_ALLOWED';

  // WhatsApp share URL
  const shareText = encodeURIComponent(
    job.whatsappMessageText ||
      `📢 ${job.titleEn || job.titleAr} at ${job.companyName} (${job.cityEn || job.cityAr})\n🔗 Details & Apply: https://ksajobs.app/jobs/${job.slug}`
  );
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${shareText}`;

  const salaryDisplay =
    job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()} ${job.salaryCurrency || 'SAR'}`
      : null;

  const displayTitle = lang === 'ar' && job.titleAr ? job.titleAr : job.titleEn || job.titleAr;
  const displayCity = lang === 'ar' && job.cityAr ? job.cityAr : job.cityEn || 'Saudi Arabia';

  const saudizationLabel =
    isSaudiOnly
      ? (lang === 'ar' ? 'سعوديين فقط 🇸🇦' : 'Saudi Only 🇸🇦')
      : isExpats
      ? (lang === 'ar' ? 'متاح للمقيمين 🌐' : 'Expats Allowed 🌐')
      : (lang === 'ar' ? 'عام' : 'Open');

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        {/* Left / Main Info */}
        <div className="flex items-start gap-4 flex-1">
          {/* Company Avatar / Logo */}
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
            {job.companyLogo ? (
              <img src={job.companyLogo} alt={job.companyName} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6 text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {/* Saudization Badge */}
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isSaudiOnly
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : isExpats
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {saudizationLabel}
              </span>

              {/* Source Platform Badge */}
              <span className="inline-flex items-center text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                {job.sourcePlatform}
              </span>

              {/* Work Type */}
              <span className="text-xs text-slate-500 font-medium">
                • {job.workType === 'REMOTE' ? t('remote') : job.workType === 'HYBRID' ? t('hybrid') : t('onsite')}
              </span>
            </div>

            {/* Title */}
            <Link href={`/jobs/${job.slug}`} className="block">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                {displayTitle}
              </h3>
            </Link>

            {/* Company & Location */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 mt-2">
              <div className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.companyName}</span>
              </div>

              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{displayCity}</span>
              </div>

              {salaryDisplay && (
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{salaryDisplay}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Button Column */}
        <div className="flex sm:flex-col items-center justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {/* Quick Apply / View Details */}
          <Link
            href={`/jobs/${job.slug}`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all text-center"
          >
            <span>{t('detailsAndApply')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Share on WhatsApp */}
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Share via WhatsApp"
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="sm:hidden">{t('shareWhatsApp')}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

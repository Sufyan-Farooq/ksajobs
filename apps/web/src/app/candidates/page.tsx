import React from 'react';
import { prisma } from '@ksajobs/database';
import {
  Users,
  Search,
  MapPin,
  Briefcase,
  GraduationCap,
  Mail,
  ShieldCheck,
  PlusCircle,
  FileText,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q;
  const city = params.city;
  const page = parseInt(params.page || '1', 10);
  const limit = 15;
  const skip = (page - 1) * limit;

  let candidates: any[] = [];
  let total = 0;

  try {
    const where: any = {
      status: 'ACTIVE',
      safetyScanStatus: 'CLEAN',
    };

    if (city && city !== 'all') {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (q) {
      where.OR = [
        { currentRole: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { skills: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, count] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.candidate.count({ where }),
    ]);

    candidates = items;
    total = count;
  } catch (err) {
    candidates = [];
    total = 0;
  }

  // Privacy helper: anonymizes candidate name for public directory (e.g. "Mohammed Al-Otaibi" -> "Mohammed A.")
  const formatPublicName = (name: string, role: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
    }
    return parts[0] || role;
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white rounded-3xl p-8 sm:p-10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Saudi PDPL Compliant &amp; Security-Scanned Talent Pool</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              Verified Candidate Profiles in <span className="text-emerald-400">Saudi Arabia</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Discover qualified professionals across Saudi Arabia. Candidate profiles are AI-verified and privacy-protected under Saudi Personal Data Protection regulations.
            </p>
          </div>

          <Link
            href="/candidates/submit"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Your Profile</span>
          </Link>
        </div>

        {/* Search Bar */}
        <form className="pt-2">
          <div className="flex items-center bg-white rounded-2xl p-1.5 shadow-lg max-w-xl">
            <div className="flex items-center flex-1 px-3 gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                name="q"
                defaultValue={q || ''}
                placeholder="Search by role, skills (e.g. Flutter, Electrical, Accountant)..."
                className="w-full text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Available Candidates</span>
          <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
            {total} {total === 1 ? 'Candidate' : 'Candidates'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>PII &amp; Raw CVs Protected</span>
        </div>
      </div>

      {/* Candidates Grid */}
      {candidates.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No candidates found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Candidates who submit their profiles will be scanned, parsed, and listed here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map((c) => {
            let skills: string[] = [];
            try {
              skills = JSON.parse(c.skills || '[]');
            } catch (e) {}

            const displayName = formatPublicName(c.name, c.currentRole);

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 space-y-4 hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Candidate Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Verified &amp; Scanned</span>
                        </span>
                        {c.nationality && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {c.nationality}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>{c.currentRole}</span>
                      </p>
                    </div>

                    {c.experienceYears && (
                      <div className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold text-center flex-shrink-0">
                        <span>{c.experienceYears}+ Yrs</span>
                      </div>
                    )}
                  </div>

                  {/* City & Education */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.city}, Saudi Arabia</span>
                    </div>
                    {c.education && (
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.education}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {c.summary}
                  </p>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skills.slice(0, 5).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-100"
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 5 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{skills.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Privacy-Protected Reach Out Action */}
                <div className="pt-3 border-t border-slate-100">
                  <a
                    href={`mailto:recruitment@ksajobs.app?subject=Inquiry for Candidate profile ${encodeURIComponent(displayName)} (${encodeURIComponent(c.currentRole)})`}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Request Candidate Contact / Interview</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

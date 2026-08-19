'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, PlusCircle, ShieldCheck, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar() {
  const { lang, toggleLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-xl text-slate-900 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-emerald-700 font-extrabold tracking-tight">KSA JOBS</span>
            <span className="text-xs text-slate-500 font-medium">{t('siteSubtitle')}</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-emerald-600 transition-colors">
            {t('allJobs')}
          </Link>
          <Link href="/candidates" className="hover:text-emerald-600 font-semibold text-emerald-700 transition-colors">
            <span>Candidates Pool 👥</span>
          </Link>
          <Link href="/?saudization=SAUDI_ONLY" className="hover:text-emerald-600 transition-colors">
            {t('saudiOnly')}
          </Link>
          <Link href="/?saudization=EXPATS_ALLOWED" className="hover:text-emerald-600 transition-colors">
            {t('expatsAllowed')}
          </Link>
          <Link href="/admin" className="hover:text-emerald-600 flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4" />
            {t('admin')}
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Language Toggle Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all"
            title="Toggle Language"
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'en' ? '🇸🇦 عربي' : '🇺🇸 English'}</span>
          </button>

          {/* Post a Job Button */}
          <Link
            href="/post-job"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('postJob')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function HeroSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const { t, lang } = useLanguage();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    router.push(`/?${params.toString()}`);
  };

  const handleQuickFilter = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, val);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white p-8 sm:p-12 mb-8 shadow-xl shadow-emerald-950/20">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('heroBadge')}</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
          {t('heroTitle')}
          <span className="text-emerald-400">{t('heroTitleHighlight')}</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal">
          {t('heroSubtitle')}
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex items-center bg-white rounded-2xl p-2 shadow-2xl border border-white/20">
            <div className="flex items-center flex-1 px-3 gap-2">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] flex-shrink-0"
            >
              {t('searchBtn')}
            </button>
          </div>
        </form>

        {/* Quick Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300 pt-2">
          <span className="text-slate-400 font-medium">{t('popularCities')}</span>
          <button
            onClick={() => handleQuickFilter('city', 'Riyadh')}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {lang === 'ar' ? 'الرياض' : 'Riyadh'}
          </button>
          <button
            onClick={() => handleQuickFilter('city', 'Jeddah')}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {lang === 'ar' ? 'جدة' : 'Jeddah'}
          </button>
          <button
            onClick={() => handleQuickFilter('city', 'Dammam')}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {lang === 'ar' ? 'الدمام' : 'Dammam'}
          </button>
          <button
            onClick={() => handleQuickFilter('city', 'NEOM')}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            NEOM
          </button>
        </div>
      </div>
    </div>
  );
}

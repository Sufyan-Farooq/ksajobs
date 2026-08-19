'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useLanguage();

  const currentCity = searchParams.get('city') || 'all';
  const currentSaudization = searchParams.get('saudization') || 'all';
  const currentWorkType = searchParams.get('workType') || 'all';

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  };

  const handleReset = () => {
    router.push('/');
  };

  const hasActiveFilters =
    currentCity !== 'all' ||
    currentSaudization !== 'all' ||
    currentWorkType !== 'all';

  return (
    <aside className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>{t('filterTitle')}</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('resetFilters')}</span>
          </button>
        )}
      </div>

      {/* Saudization Status */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2.5">
          {t('saudizationTitle')}
        </label>
        <div className="space-y-1.5">
          {[
            { id: 'all', label: t('all') },
            { id: 'SAUDI_ONLY', label: lang === 'ar' ? 'سعوديين فقط 🇸🇦' : 'Saudi Only 🇸🇦' },
            { id: 'EXPATS_ALLOWED', label: lang === 'ar' ? 'متاح للمقيمين 🌐' : 'Expats Allowed 🌐' },
            { id: 'SAUDIS_PREFERRED', label: lang === 'ar' ? 'الأفضلية للسعوديين 🇸🇦' : 'Saudis Preferred 🇸🇦' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleFilterChange('saudization', item.id)}
              className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentSaudization === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* City */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2.5">
          {t('cityTitle')}
        </label>
        <div className="space-y-1.5">
          {[
            { id: 'all', label: t('all') },
            { id: 'Riyadh', label: lang === 'ar' ? 'الرياض (Riyadh)' : 'Riyadh' },
            { id: 'Jeddah', label: lang === 'ar' ? 'جدة (Jeddah)' : 'Jeddah' },
            { id: 'Dammam', label: lang === 'ar' ? 'الدمام (Dammam)' : 'Dammam' },
            { id: 'Khobar', label: lang === 'ar' ? 'الخبر (Khobar)' : 'Al Khobar' },
            { id: 'NEOM', label: lang === 'ar' ? 'نيوم (NEOM)' : 'NEOM' },
            { id: 'Mecca', label: lang === 'ar' ? 'مكة المكرمة' : 'Mecca' },
            { id: 'Medina', label: lang === 'ar' ? 'المدينة المنورة' : 'Medina' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleFilterChange('city', item.id)}
              className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentCity === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Type */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2.5">
          {t('workTypeTitle')}
        </label>
        <div className="space-y-1.5">
          {[
            { id: 'all', label: t('all') },
            { id: 'ONSITE', label: t('onsite') },
            { id: 'REMOTE', label: t('remote') },
            { id: 'HYBRID', label: t('hybrid') },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleFilterChange('workType', item.id)}
              className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentWorkType === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

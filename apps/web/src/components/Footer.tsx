'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t, lang } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 mt-20 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2 text-white font-bold text-xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <Briefcase className="w-4 h-4" />
              </div>
              <span>KSA JOBS</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t('footerAbout')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t('footerCities')}</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/?city=Riyadh" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'وظائف الرياض' : 'Jobs in Riyadh'}</Link></li>
              <li><Link href="/?city=Jeddah" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'وظائف جدة' : 'Jobs in Jeddah'}</Link></li>
              <li><Link href="/?city=Dammam" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'وظائف الدمام والخبر' : 'Jobs in Dammam & Khobar'}</Link></li>
              <li><Link href="/?city=NEOM" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'وظائف نيوم' : 'Jobs in NEOM'}</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t('footerCategories')}</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/?category=IT" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'تقنية المعلومات' : 'IT & Software Development'}</Link></li>
              <li><Link href="/?category=Engineering" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'الهندسة والمشاريع' : 'Engineering & Projects'}</Link></li>
              <li><Link href="/?category=Sales" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'المبيعات والتسويق' : 'Sales & Marketing'}</Link></li>
              <li><Link href="/?category=Healthcare" className="hover:text-emerald-400 transition-colors">{lang === 'ar' ? 'الرعاية الصحية' : 'Healthcare & Medical'}</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t('footerCommunity')}</h4>
            <p className="text-xs text-slate-400 mb-3">
              {lang === 'ar'
                ? 'انضم لقنوات ومجموعات الواتساب الرسمية لتلقي التحديثات الفورية.'
                : 'Join our official WhatsApp channel and groups for real-time daily job vacancy alerts.'}
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://whatsapp.com/channel/0029VaV5YUCBadmh65NdqH46"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('officialWhatsAppChannel')}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} KSA JOBS. {t('copyright')}</p>
          <div className="flex items-center gap-1">
            <span>{t('madeWithLove')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    siteTitle: 'KSA Jobs',
    siteSubtitle: 'Saudi Arabia Careers Portal',
    allJobs: 'All Jobs',
    saudiOnly: 'Saudi Only 🇸🇦',
    expatsAllowed: 'Expats Allowed 🌐',
    admin: 'Admin Dashboard',
    postJob: 'Post a Job Free',
    heroBadge: 'Live 24/7 Updates with Verified KSA Opportunities 🇸🇦',
    heroTitle: 'Find Your Next Career Opportunity in ',
    heroTitleHighlight: 'Saudi Arabia',
    heroSubtitle: 'Thousands of daily job vacancies updated across Riyadh, Jeddah, Dammam, NEOM, and all KSA regions.',
    searchPlaceholder: 'Job title, company name, or skills...',
    searchBtn: 'Search',
    popularCities: 'Popular Cities:',
    filterTitle: 'Filter Results',
    resetFilters: 'Reset',
    saudizationTitle: '🇸🇦 Saudization Status',
    cityTitle: '📍 City',
    workTypeTitle: '💼 Work Type',
    all: 'All',
    onsite: 'Onsite 🏢',
    remote: 'Remote 🏠',
    hybrid: 'Hybrid 🔄',
    availableJobs: 'Available Vacancies',
    jobsCount: 'jobs',
    detailsAndApply: 'Details & Apply',
    shareWhatsApp: 'Share',
    salaryNotSpecified: 'Not specified',
    backToJobs: 'Back to all jobs',
    jobDetails: 'Job Description',
    requirementsTitle: 'Requirements & Qualifications',
    benefitsTitle: 'Benefits & Perks',
    skillsRequired: 'Required Skills:',
    directContact: 'Direct Employer Contact:',
    applyNow: 'Apply for this Job',
    shareOnWhatsApp: 'Share via WhatsApp',
    expSalary: 'Expected Salary',
    experienceReq: 'Required Experience',
    jobCategory: 'Category / Sector',
    employmentType: 'Employment Type',
    fullTime: 'Full Time',
    partTime: 'Part Time',
    footerAbout: 'The fastest and most comprehensive portal for the latest job openings in Saudi Arabia with real-time updates and interactive WhatsApp groups.',
    footerCities: 'Jobs by City',
    footerCategories: 'Popular Sectors',
    footerCommunity: 'Join Our Community',
    officialWhatsAppChannel: 'Official WhatsApp Channel',
    copyright: '© All rights reserved for Saudi Arabia.',
    madeWithLove: 'Built with passion for the Saudi job market 🇸🇦',
  },
  ar: {
    siteTitle: 'وظائف السعودية',
    siteSubtitle: 'بوابة التوظيف الشاملة',
    allJobs: 'جميع الوظائف',
    saudiOnly: 'سعوديين فقط 🇸🇦',
    expatsAllowed: 'متاح للمقيمين 🌐',
    admin: 'لوحة التحكم',
    postJob: 'أضف وظيفة مجاناً',
    heroBadge: 'تحديث مباشر على مدار الساعة بأحدث وظائف المملكة 🇸🇦',
    heroTitle: 'ابحث عن وظيفتك القادمة في ',
    heroTitleHighlight: 'السعودية',
    heroSubtitle: 'آلاف الفرص الوظيفية المحدثة يومياً من كبرى الشركات في الرياض، جدة، الشرقية، وجميع مناطق المملكة.',
    searchPlaceholder: 'المسمى الوظيفي، اسم الشركة، أو المهارة...',
    searchBtn: 'بحث',
    popularCities: 'المدن الشائعة:',
    filterTitle: 'تصفية النتائج',
    resetFilters: 'إعادة ضبط',
    saudizationTitle: '🇸🇦 حالة السعودة',
    cityTitle: '📍 المدينة',
    workTypeTitle: '💼 طبيعة العمل',
    all: 'الكل',
    onsite: 'حضوري بالكامل 🏢',
    remote: 'عن بعد 🏠',
    hybrid: 'هجين 🔄',
    availableJobs: 'الوظائف الشاغرة المتاحة',
    jobsCount: 'وظيفة',
    detailsAndApply: 'التفاصيل والتقديم',
    shareWhatsApp: 'مشاركة',
    salaryNotSpecified: 'غير محدد',
    backToJobs: 'العودة لجميع الوظائف',
    jobDetails: 'تفاصيل الوظيفة',
    requirementsTitle: 'المتطلبات والشروط',
    benefitsTitle: 'المزايا والحوافز',
    skillsRequired: 'المهارات المطلوبة:',
    directContact: 'معلومات التواصل المباشر مع صاحب العمل:',
    applyNow: 'التقديم للوظيفة الآن',
    shareOnWhatsApp: 'مشاركة عبر الواتساب',
    expSalary: 'الراتب المتوقع',
    experienceReq: 'الخبرة المطلوبة',
    jobCategory: 'المجال / التخصص',
    employmentType: 'طبيعة الدوام',
    fullTime: 'دوام كامل',
    partTime: 'دوام جزئي',
    footerAbout: 'المنصة الأسرع والأشمل لمتابعة أحدث الوظائف الشاغرة في جميع مدن المملكة العربية السعودية مع التحديث الفوري وقنوات الواتساب التفاعلية.',
    footerCities: 'الوظائف حسب المدينة',
    footerCategories: 'التخصصات الأكثر طلباً',
    footerCommunity: 'انضم لمجتمعنا',
    officialWhatsAppChannel: 'قناة الواتساب الرسمية',
    copyright: '© جميع الحقوق محفوظة للمملكة العربية السعودية.',
    madeWithLove: 'صُنع بشغف لسوق العمل السعودي 🇸🇦',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('en'); // English by default!

  useEffect(() => {
    const saved = localStorage.getItem('ksajobs_lang') as Language;
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem('ksajobs_lang', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
  };

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

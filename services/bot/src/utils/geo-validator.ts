/**
 * Comprehensive Strict Saudi Arabia Geolocation Validator
 * Guarantees that only genuine jobs in Saudi Arabia are accepted.
 * Immediately rejects foreign / non-KSA countries (Korea, US, UK, India, Dubai, etc.).
 */

const SAUDI_CITIES_AND_REGIONS = [
  'saudi arabia',
  'saudi',
  'ksa',
  'riyadh',
  'jeddah',
  'dammam',
  'khobar',
  'al khobar',
  'dhahran',
  'mecca',
  'makkah',
  'medina',
  'madinah',
  'jubail',
  'al jubail',
  'yanbu',
  'tabuk',
  'neom',
  'taif',
  'al ahsa',
  'ahsa',
  'hofuf',
  'al-kharj',
  'kharj',
  'qassim',
  'buraidah',
  'unaizah',
  'hail',
  'najran',
  'jizan',
  'jazan',
  'abha',
  'khamis mushait',
  'khamis',
  'arar',
  'sakaka',
  'al jouf',
  'ras al khair',
  'eastern province',
  'western province',
  // Arabic terms
  'السعودية',
  'المملكة العربية السعودية',
  'الرياض',
  'جدة',
  'الدمام',
  'الخبر',
  'الظهران',
  'مكة',
  'مكة المكرمة',
  'المدينة',
  'المدينة المنورة',
  'الجبيل',
  'ينبع',
  'تبوك',
  'نيوم',
  'الطائف',
  'الأحساء',
  'الهفوف',
  'الخرج',
  'القصيم',
  'بريدة',
  'عنيزة',
  'حائل',
  'نجران',
  'جيزان',
  'جازان',
  'أبها',
  'خميس مشيط',
  'عرعر',
  'سكاكا',
  'الجوف',
  'المنطقة الشرقية',
];

const FOREIGN_LOCATIONS_BLACKLIST = [
  'seoul',
  'korea',
  'south korea',
  'tokyo',
  'japan',
  'singapore',
  'hong kong',
  'taiwan',
  'taipei',
  'beijing',
  'shanghai',
  'china',
  'bangkok',
  'thailand',
  'kuala lumpur',
  'malaysia',
  'jakarta',
  'indonesia',
  'manila',
  'philippines',
  'vietnam',
  'hanoi',
  'mumbai',
  'delhi',
  'bangalore',
  'india',
  'pakistan',
  'lahore',
  'karachi',
  'dhaka',
  'bangladesh',
  'london',
  'united kingdom',
  'manchester',
  'birmingham',
  'uk',
  'toronto',
  'montreal',
  'vancouver',
  'canada',
  'berlin',
  'munich',
  'frankfurt',
  'germany',
  'paris',
  'france',
  'madrid',
  'spain',
  'rome',
  'milan',
  'italy',
  'amsterdam',
  'netherlands',
  'zurich',
  'switzerland',
  'missouri',
  'texas',
  'california',
  'new york',
  'chicago',
  'illinois',
  'florida',
  'ohio',
  'united states',
  'usa',
  'dubai',
  'abu dhabi',
  'uae',
  'united arab emirates',
  'doha',
  'qatar',
  'manama',
  'bahrain',
  'kuwait city',
  'kuwait',
  'muscat',
  'oman',
  'cairo',
  'alexandria',
  'egypt',
  'amman',
  'jordan',
  'beirut',
  'lebanon',
  'sydney',
  'melbourne',
  'australia',
  'auckland',
  'new zealand',
];

const FOREIGN_URL_SUBDOMAINS = [
  'kr.linkedin.com',
  'in.linkedin.com',
  'uk.linkedin.com',
  'us.linkedin.com',
  'de.linkedin.com',
  'fr.linkedin.com',
  'ca.linkedin.com',
  'au.linkedin.com',
  'es.linkedin.com',
  'it.linkedin.com',
  'nl.linkedin.com',
  'jp.linkedin.com',
  'sg.linkedin.com',
  'my.linkedin.com',
  'ph.linkedin.com',
  'pk.linkedin.com',
  'eg.linkedin.com',
  'ae.linkedin.com',
  'qa.linkedin.com',
  'bh.linkedin.com',
  'kw.linkedin.com',
  'om.linkedin.com',
];

/**
 * Validates if a job URL, location string, and content belong strictly to Saudi Arabia.
 */
export function isStrictlyInSaudiArabia(params: {
  url?: string;
  location?: string;
  title?: string;
  description?: string;
}): boolean {
  const { url = '', location = '', title = '', description = '' } = params;

  // 1. Check URL subdomain
  const lowerUrl = url.toLowerCase();
  for (const subdomain of FOREIGN_URL_SUBDOMAINS) {
    if (lowerUrl.includes(subdomain)) {
      return false;
    }
  }

  // 2. Check Location String against foreign blacklists
  const lowerLoc = location.toLowerCase().trim();
  for (const foreign of FOREIGN_LOCATIONS_BLACKLIST) {
    // If location contains a foreign city/country and does NOT contain saudi/ksa
    if (lowerLoc.includes(foreign) && !lowerLoc.includes('saudi') && !lowerLoc.includes('ksa')) {
      return false;
    }
  }

  // 3. Check if Location matches known Saudi cities or regions
  const matchesSaudiLoc = SAUDI_CITIES_AND_REGIONS.some((city) => lowerLoc.includes(city));
  
  // If location is provided and does not match any Saudi region, check description
  if (lowerLoc && !matchesSaudiLoc) {
    // Check if foreign location is mentioned in title or description work location
    const lowerDesc = description.toLowerCase();
    for (const foreign of FOREIGN_LOCATIONS_BLACKLIST) {
      if (
        lowerDesc.includes(`based in ${foreign}`) ||
        lowerDesc.includes(`based out of our ${foreign}`) ||
        lowerDesc.includes(`office in ${foreign}`) ||
        lowerDesc.includes(`location: ${foreign}`) ||
        lowerDesc.includes(`located in ${foreign}`)
      ) {
        return false;
      }
    }
  }

  // 4. Check for foreign compensation structures (401k, USD hourly) without KSA context
  const lowerDescFull = description.toLowerCase();
  if (
    (lowerDescFull.includes('401(k)') || lowerDescFull.includes('401k') || lowerDescFull.includes('rrsp')) &&
    (lowerDescFull.includes('$') || lowerDescFull.includes('£')) &&
    !lowerDescFull.includes('riyadh') &&
    !lowerDescFull.includes('jeddah') &&
    !lowerDescFull.includes('dammam') &&
    !lowerDescFull.includes('saudi arabia')
  ) {
    return false;
  }

  // 5. Must have at least general Saudi affiliation
  const hasSaudiAffiliation =
    matchesSaudiLoc ||
    lowerUrl.includes('saudi') ||
    lowerUrl.includes('ksa') ||
    SAUDI_CITIES_AND_REGIONS.some((city) => lowerDescFull.includes(city));

  return hasSaudiAffiliation;
}

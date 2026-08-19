import { NextRequest, NextResponse } from 'next/server';
import { jobRepository, prisma, generateSlug } from '@ksajobs/database';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') || undefined;
  const category = searchParams.get('category') || undefined;
  const saudization = searchParams.get('saudization') || undefined;
  const workType = searchParams.get('workType') || undefined;
  const searchQuery = searchParams.get('q') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

  try {
    const data = await jobRepository.findPublishedJobs({
      city,
      category,
      saudization,
      workType,
      searchQuery,
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      company,
      city,
      saudization,
      workType,
      salaryMin,
      salaryMax,
      description,
      requirements,
      applyUrl,
      contactEmail,
      contactPhone,
    } = body;

    if (!title || !company || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const slug = generateSlug(title, company);
    const reqArray = requirements
      ? requirements.split('\n').map((s: string) => s.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
      : [];

    const cityMap: Record<string, string> = {
      Riyadh: 'الرياض',
      Jeddah: 'جدة',
      Dammam: 'الدمام',
      Khobar: 'الخبر',
      NEOM: 'نيوم',
      Mecca: 'مكة المكرمة',
      Medina: 'المدينة المنورة',
    };

    const saudizationMap: Record<string, string> = {
      SAUDI_ONLY: 'سعوديين فقط 🇸🇦',
      EXPATS_ALLOWED: 'متاح للمقيمين 🌐',
      SAUDIS_PREFERRED: 'الأفضلية للسعوديين 🇸🇦',
    };

    const cityAr = cityMap[city] || city;
    const saudizationLabelAr = saudizationMap[saudization] || 'عام';

    const whatsappText = `📢 *فرصة عمل جديدة في السعودية 🇸🇦*

🏢 *الجهة:* ${company}
💼 *المسمى الوظيفي:* ${title}
📍 *الموقع:* ${cityAr}
🇸🇦 *حالة السعودة:* ${saudizationLabelAr}
${salaryMin && salaryMax ? `💰 *الراتب:* ${salaryMin} - ${salaryMax} ريال\n` : ''}
📋 *الوصف والمتطلبات:*
${description}

📲 *طريقة التقديم:*
${contactEmail ? `📧 البريد: ${contactEmail}\n` : ''}${contactPhone ? `💬 واتساب/هاتف: ${contactPhone}\n` : ''}${applyUrl ? `🔗 رابط التقديم: ${applyUrl}\n` : ''}
---
🌐 للمزيد من الوظائف: https://ksajobs.app`;

    const job = await prisma.job.create({
      data: {
        slug,
        titleEn: title,
        titleAr: title,
        companyName: company,
        cityEn: city || 'Riyadh',
        cityAr,
        workType: workType || 'ONSITE',
        jobType: 'FULL_TIME',
        saudization: saudization || 'EXPATS_ALLOWED',
        saudizationLabelAr,
        salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
        salaryMax: salaryMax ? parseInt(salaryMax, 10) : null,
        salaryCurrency: 'SAR',
        category: 'General',
        categoryAr: 'عام',
        descriptionRaw: description,
        descriptionFormatted: description,
        requirements: JSON.stringify(reqArray),
        benefits: JSON.stringify([]),
        skills: JSON.stringify([]),
        sourcePlatform: 'manual',
        sourceUrl: `https://ksajobs.app/jobs/${slug}`,
        contactEmail,
        contactPhone,
        applyUrl: applyUrl || `https://ksajobs.app/jobs/${slug}`,
        whatsappMessageText: whatsappText,
        status: 'PENDING_APPROVAL',
      },
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

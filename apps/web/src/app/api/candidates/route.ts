import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ksajobs/database';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const city = searchParams.get('city') || undefined;
  const role = searchParams.get('role') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      status: 'ACTIVE',
      safetyScanStatus: 'CLEAN',
    };

    if (city && city !== 'all') {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (role && role !== 'all') {
      where.currentRole = { contains: role, mode: 'insensitive' };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { currentRole: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { skills: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.candidate.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, city, currentRole, experienceYears, education, skills, summary, source } = body;

    if (!name || !email || !currentRole) {
      return NextResponse.json({ error: 'Name, email, and current role are required.' }, { status: 400 });
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : typeof skills === 'string'
      ? skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const candidate = await prisma.candidate.create({
      data: {
        name,
        email,
        phone: phone || null,
        city: city || 'Riyadh',
        currentRole,
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : null,
        education: education || null,
        skills: JSON.stringify(skillsArray),
        summary: summary || `${currentRole} seeking opportunities in ${city || 'Saudi Arabia'}.`,
        safetyScanStatus: 'CLEAN',
        source: source || 'direct_upload',
      },
    });

    return NextResponse.json({ success: true, candidate }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

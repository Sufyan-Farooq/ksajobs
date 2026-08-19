import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ksajobs/database';

export async function GET() {
  try {
    const groups = await prisma.whatsAppGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { broadcastLogs: true },
        },
      },
    });
    return NextResponse.json(groups);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, jid, name, cityFilter } = body;

    if (action === 'toggle' && id) {
      const group = await prisma.whatsAppGroup.findUnique({ where: { id } });
      if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const updated = await prisma.whatsAppGroup.update({
        where: { id },
        data: { isActive: !group.isActive },
      });
      return NextResponse.json(updated);
    }

    if (action === 'add' && jid && name) {
      const created = await prisma.whatsAppGroup.create({
        data: {
          jid,
          name,
          cityFilter: cityFilter || null,
          isActive: true,
        },
      });
      return NextResponse.json(created, { status: 201 });
    }

    if (action === 'delete' && id) {
      await prisma.whatsAppGroup.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

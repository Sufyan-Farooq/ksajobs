import { NextRequest, NextResponse } from 'next/server';
import { jobRepository } from '@ksajobs/database';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  try {
    if (action === 'approve') {
      await jobRepository.approveJob(id, 'Web Admin');
    } else if (action === 'reject') {
      await jobRepository.rejectJob(id, 'Rejected via Web Admin');
    }

    return NextResponse.redirect(new URL('/admin', req.url));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

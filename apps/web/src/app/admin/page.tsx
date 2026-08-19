import React from 'react';
import { prisma } from '@ksajobs/database';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Users,
  Send,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import AdminJobModerationCard from '../../components/AdminJobModerationCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  let pendingJobs: any[] = [];
  let stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  try {
    const [total, pending, approved, rejected, pendingList] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.job.count({ where: { status: 'APPROVED' } }),
      prisma.job.count({ where: { status: 'REJECTED' } }),
      prisma.job.findMany({
        where: { status: 'PENDING_APPROVAL' },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
    ]);

    stats = { total, pending, approved, rejected };
    pendingJobs = pendingList;
  } catch (err) {
    // Fallback if DB is initializing
  }

  return (
    <div className="space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admin &amp; Moderation Dashboard</h1>
            <p className="text-xs text-slate-500">Live review, full WhatsApp broadcast messages, and distribution controls</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/candidates"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all"
          >
            <Users className="w-4 h-4" />
            <span>Manage Candidates</span>
          </Link>
          <Link
            href="/admin/groups"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Manage WhatsApp</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Discord Bot: Active 🟢</span>
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Total Scraped Jobs</p>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <p className="text-xs font-medium text-amber-800 mb-1">Pending Review</p>
          <p className="text-2xl font-black text-amber-700">{stats.pending}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <p className="text-xs font-medium text-emerald-800 mb-1">Approved &amp; Broadcasted</p>
          <p className="text-2xl font-black text-emerald-700">{stats.approved}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Rejected</p>
          <p className="text-2xl font-black text-rose-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Pending Moderation Queue with Full Message Previews */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 font-black text-slate-900 text-base">
            <Clock className="w-5 h-5 text-amber-500" />
            <span>Pending Moderation Queue ({pendingJobs.length})</span>
          </div>
          <span className="text-xs text-slate-400">Click any card to expand full WhatsApp message &amp; details</span>
        </div>

        {pendingJobs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800">No pending jobs in queue!</p>
            <p className="text-xs text-slate-400">All scraped jobs have been moderated, or the next scrape run is pending.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingJobs.map((job) => (
              <AdminJobModerationCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { prisma } from '@ksajobs/database';
import {
  Users,
  ShieldCheck,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q;

  let candidates: any[] = [];
  let stats = {
    total: 0,
    clean: 0,
    flagged: 0,
  };

  try {
    const [total, clean, flagged, list] = await Promise.all([
      prisma.candidate.count(),
      prisma.candidate.count({ where: { safetyScanStatus: 'CLEAN' } }),
      prisma.candidate.count({ where: { safetyScanStatus: 'FLAGGED' } }),
      prisma.candidate.findMany({
        where: q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { currentRole: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    stats = { total, clean, flagged };
    candidates = list;
  } catch (err) {}

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admin Candidate &amp; CV Management</h1>
            <p className="text-xs text-slate-500">Unrestricted recruiter view with full PII, contacts, and attached CV downloads</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Main Dashboard</span>
          </Link>
          <Link
            href="/candidates"
            target="_blank"
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
          >
            <span>Public Directory (Anonymized)</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Total Ingested Candidates</p>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <p className="text-xs font-medium text-emerald-800 mb-1">Security Verified (Clean)</p>
          <p className="text-2xl font-black text-emerald-700">{stats.clean}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-sm">
          <p className="text-xs font-medium text-rose-800 mb-1">Flagged / Anomaly Files</p>
          <p className="text-2xl font-black text-rose-600">{stats.flagged}</p>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Ingested Candidate Profiles ({candidates.length})</span>
          </div>

          <form className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q || ''}
              placeholder="Filter by name, role, or email..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
            >
              Filter
            </button>
          </form>
        </div>

        {candidates.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800">No candidate CVs found in database</p>
            <p className="text-xs">
              Configure `GMAIL_USER` &amp; `GMAIL_APP_PASSWORD` in `.env` and run `pnpm scan:gmail:all` to ingest past CVs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.safetyScanStatus === 'CLEAN'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {c.safetyScanStatus === 'CLEAN' ? 'Verified Clean 🛡️' : 'Flagged ⚠️'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Source: {c.source} • {new Date(c.createdAt).toLocaleDateString('en-US')}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                  <p className="text-xs font-semibold text-emerald-700">{c.currentRole} • {c.city}, Saudi Arabia</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{c.summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Attached CV Download Button */}
                  {c.resumeUrl && (
                    <a
                      href={c.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Download CV</span>
                    </a>
                  )}

                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </a>

                  {c.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${c.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

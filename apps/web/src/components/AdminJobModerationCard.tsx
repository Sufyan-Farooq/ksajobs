'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  Calendar,
  Briefcase,
  Share2,
} from 'lucide-react';

interface JobData {
  id: string;
  slug: string;
  titleEn: string;
  titleAr?: string | null;
  companyName: string;
  cityEn: string;
  cityAr?: string | null;
  workType: string;
  jobType: string;
  saudization: string;
  sourcePlatform: string;
  sourceUrl: string;
  applyUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  descriptionFormatted: string;
  descriptionRaw: string;
  whatsappMessageText: string;
  createdAt: string | Date;
}

export default function AdminJobModerationCard({ job }: { job: JobData }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null);
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  const handleCopy = () => {
    navigator.clipboard.writeText(job.whatsappMessageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModerate = async (action: 'approve' | 'reject') => {
    setLoadingAction(action);
    try {
      const res = await fetch(`/api/jobs/approve?id=${job.id}&action=${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        setStatus(action === 'approve' ? 'APPROVED' : 'REJECTED');
      }
    } catch (e) {
    } finally {
      setLoadingAction(null);
    }
  };

  if (status !== 'PENDING') {
    return (
      <div className={`p-4 rounded-2xl border transition ${
        status === 'APPROVED' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-100/50 border-slate-200 opacity-60'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'APPROVED' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-slate-400" />
            )}
            <span className="font-bold text-slate-800 text-sm">{job.titleEn || job.titleAr}</span>
            <span className="text-xs text-slate-500">• {job.companyName}</span>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {status === 'APPROVED' ? 'Approved & Broadcasted ✅' : 'Rejected ❌'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all">
      {/* Header Summary */}
      <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Pending Review
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
              {job.sourcePlatform}
            </span>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {job.cityEn || 'Saudi Arabia'}
            </span>
            <span className="text-xs text-slate-400">
              • {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <h3 className="font-black text-slate-900 text-lg leading-snug">
            {job.titleEn || job.titleAr}
          </h3>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {job.companyName}
            </span>
            <span>•</span>
            <span className="capitalize">{job.workType.toLowerCase()} / {job.jobType.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Hide Full Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> View Full Message &amp; Details
              </>
            )}
          </button>

          <button
            onClick={() => handleModerate('approve')}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve &amp; Broadcast</span>
          </button>

          <button
            onClick={() => handleModerate('reject')}
            disabled={loadingAction !== null}
            className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            title="Reject Posting"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Full Details & WhatsApp Message Box */}
      {isExpanded && (
        <div className="p-6 space-y-6 bg-white animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* WhatsApp Message Preview Bubble */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  WhatsApp Formatted Post (Live Broadcast Text)
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              <div className="bg-emerald-950/5 border border-emerald-200/80 p-4 rounded-2xl text-slate-800 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
                {job.whatsappMessageText}
              </div>
            </div>

            {/* Structured Info & Raw Description */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Extracted Job Details
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Location:</span>
                    <span className="font-bold text-slate-900">{job.cityEn}, Saudi Arabia</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Saudization:</span>
                    <span className="font-bold text-slate-900">{job.saudization.replace('_', ' ')}</span>
                  </div>
                  {job.contactEmail && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="font-semibold text-slate-500">Email:</span>
                      <a href={`mailto:${job.contactEmail}`} className="font-bold text-emerald-700 hover:underline">
                        {job.contactEmail}
                      </a>
                    </div>
                  )}
                  {job.contactPhone && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="font-semibold text-slate-500">WhatsApp / Phone:</span>
                      <a href={`https://wa.me/${job.contactPhone.replace(/[^0-9]/g, '')}`} target="_blank" className="font-bold text-emerald-700 hover:underline">
                        {job.contactPhone}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between py-1 items-center">
                    <span className="font-semibold text-slate-500">Apply Link:</span>
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-700 hover:underline flex items-center gap-1 truncate max-w-[220px]"
                    >
                      <span className="truncate">{job.applyUrl}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Full Raw Description
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {job.descriptionRaw || job.descriptionFormatted}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

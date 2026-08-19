'use client';

import React, { useState } from 'react';
import { MessageSquare, Copy, Check } from 'lucide-react';

export default function WhatsAppCopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  return (
    <div className="space-y-3 p-5 rounded-2xl bg-emerald-950/5 border border-emerald-200/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>WhatsApp Broadcast Message</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied to Clipboard!' : 'Copy Formatted Post'}</span>
        </button>
      </div>

      <div className="p-4 rounded-xl bg-white border border-emerald-100 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all shadow-inner">
        {text}
      </div>
    </div>
  );
}

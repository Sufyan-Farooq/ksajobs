'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Radio,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface WhatsAppGroupItem {
  id: string;
  name: string;
  jid: string;
  cityFilter?: string | null;
  categoryFilter?: string | null;
  isActive: boolean;
  _count?: {
    broadcastLogs: number;
  };
}

export default function ManageWhatsAppGroupsPage() {
  const [groups, setGroups] = useState<WhatsAppGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJid, setNewJid] = useState('');
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle' }),
      });
      if (res.ok) {
        setGroups(groups.map((g) => (g.id === id ? { ...g, isActive: !g.isActive } : g)));
      }
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this group?')) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      if (res.ok) {
        setGroups(groups.filter((g) => g.id !== id));
      }
    } catch (e) {}
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJid || !newName) return;

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          jid: newJid,
          name: newName,
          cityFilter: newCity || null,
        }),
      });
      if (res.ok) {
        setNewJid('');
        setNewName('');
        setNewCity('');
        fetchGroups();
      }
    } catch (e) {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manage WhatsApp Groups &amp; Channels</h1>
            <p className="text-xs text-slate-500">Select which groups and broadcast channels receive approved job postings</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Main Admin Dashboard</span>
          </Link>
          <button
            onClick={fetchGroups}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Manual Add Card */}
      <form onSubmit={handleAdd} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-emerald-600" />
          <span>Add WhatsApp Group / Channel Manually</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            placeholder="Group / Channel Name (e.g. KSA Jobs - Riyadh)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            required
            dir="ltr"
            placeholder="JID or Channel ID (e.g. 120363xxx@g.us or newsletter)"
            value={newJid}
            onChange={(e) => setNewJid(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Group</span>
          </button>
        </div>
      </form>

      {/* Groups List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <Radio className="w-4 h-4 text-emerald-600" />
            <span>Registered WhatsApp Groups &amp; Channels ({groups.length})</span>
          </div>
          <span className="text-xs text-slate-400">Toggle any group on or off with 1 click to control broadcasts</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading registered groups...</div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800">No WhatsApp groups registered yet!</p>
            <p className="text-xs">
              When you launch the bot (`pnpm dev:bot`) and scan the QR code, your joined groups will automatically sync here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((g) => (
              <div
                key={g.id}
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        g.isActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {g.isActive ? 'Active for Broadcast 🟢' : 'Disabled ⚪'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400" dir="ltr">
                      {g.jid}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{g.name}</h3>
                  <p className="text-xs text-slate-400">
                    Total messages broadcasted: {g._count?.broadcastLogs || 0}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(g.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      g.isActive
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                  >
                    {g.isActive ? (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Disable Broadcast</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enable Broadcast</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

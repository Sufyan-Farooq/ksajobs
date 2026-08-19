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
  Users,
  Megaphone,
  Power,
} from 'lucide-react';

interface WhatsAppTargetItem {
  id: string;
  name: string;
  jid: string;
  isChannel: boolean;
  cityFilter?: string | null;
  categoryFilter?: string | null;
  isActive: boolean;
  _count?: {
    broadcastLogs: number;
  };
}

export default function ManageWhatsAppTargetsPage() {
  const [items, setItems] = useState<WhatsAppTargetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'groups' | 'channels'>('groups');
  
  // Add target state
  const [newJid, setNewJid] = useState('');
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle' }),
      });
      if (res.ok) {
        setItems(items.map((g) => (g.id === id ? { ...g, isActive: !g.isActive } : g)));
      }
    } catch (e) {}
  };

  const handleBulkToggle = async (targetType: 'group' | 'channel', enableState: boolean) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_toggle',
          targetType,
          enableState,
        }),
      });
      if (res.ok) {
        const isChannelTarget = targetType === 'channel';
        setItems(items.map((i) => (Boolean(i.isChannel) === isChannelTarget ? { ...i, isActive: enableState } : i)));
      }
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this target?')) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      if (res.ok) {
        setItems(items.filter((g) => g.id !== id));
      }
    } catch (e) {}
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJid || !newName) return;

    try {
      const isChannel = activeTab === 'channels' || newJid.includes('@newsletter');
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          jid: newJid,
          name: newName,
          cityFilter: newCity || null,
          isChannel,
        }),
      });
      if (res.ok) {
        setNewJid('');
        setNewName('');
        setNewCity('');
        fetchTargets();
      }
    } catch (e) {}
  };

  const groupItems = items.filter((i) => !i.isChannel && !i.jid.includes('@newsletter'));
  const channelItems = items.filter((i) => i.isChannel || i.jid.includes('@newsletter'));

  const currentDisplayList = activeTab === 'groups' ? groupItems : channelItems;
  const activeCount = currentDisplayList.filter((i) => i.isActive).length;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-emerald-700 hover:text-emerald-800 text-sm font-semibold flex items-center gap-1">
                Admin Panel <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-3">
              <Radio className="w-7 h-7 text-emerald-600 animate-pulse" />
              WhatsApp Distribution Manager
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Control which WhatsApp groups and broadcast channels receive approved job alerts.
            </p>
          </div>

          <button
            onClick={fetchTargets}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Targets
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="flex bg-slate-200/70 p-1 rounded-2xl max-w-md">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl font-bold text-sm transition ${
                activeTab === 'groups'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              WhatsApp Groups ({groupItems.length})
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl font-bold text-sm transition ${
                activeTab === 'channels'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Megaphone className="w-4 h-4 text-emerald-600" />
              WhatsApp Channels ({channelItems.length})
            </button>
          </div>

          {/* Bulk Action Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleBulkToggle(activeTab === 'groups' ? 'group' : 'channel', true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition"
            >
              <Power className="w-3.5 h-3.5" />
              Enable All {activeTab === 'groups' ? 'Groups' : 'Channels'}
            </button>
            <button
              onClick={() => handleBulkToggle(activeTab === 'groups' ? 'group' : 'channel', false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-500" />
              Disable All {activeTab === 'groups' ? 'Groups' : 'Channels'}
            </button>
          </div>
        </div>

        {/* Add Target Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" />
            Add New {activeTab === 'groups' ? 'WhatsApp Group' : 'WhatsApp Channel'} Manually
          </h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder={activeTab === 'groups' ? 'Group JID (e.g. 120363023456789012@g.us)' : 'Channel JID (e.g. 120363023456789012@newsletter)'}
                value={newJid}
                onChange={(e) => setNewJid(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                required
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Target Name / Label"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                required
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Add {activeTab === 'groups' ? 'Group' : 'Channel'}
              </button>
            </div>
          </form>
        </div>

        {/* Targets Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {activeTab === 'groups' ? <Users className="w-5 h-5 text-emerald-600" /> : <Megaphone className="w-5 h-5 text-emerald-600" />}
                {activeTab === 'groups' ? 'Configured WhatsApp Groups' : 'Configured WhatsApp Channels'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active Broadcast Targets: <span className="font-bold text-emerald-700">{activeCount} of {currentDisplayList.length} enabled</span>
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
              Loading targets...
            </div>
          ) : currentDisplayList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">No {activeTab} discovered yet.</p>
              <p className="text-xs text-slate-400">
                When you start the bot service, all joined {activeTab} will automatically sync here (disabled by default).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Name & JID</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Broadcast Status</th>
                    <th className="px-6 py-3.5">Total Broadcasts</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentDisplayList.map((target) => (
                    <tr key={target.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{target.name}</div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-xs">{target.jid}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          target.isChannel || target.jid.includes('@newsletter')
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {target.isChannel || target.jid.includes('@newsletter') ? (
                            <>
                              <Megaphone className="w-3 h-3" />
                              Channel
                            </>
                          ) : (
                            <>
                              <Users className="w-3 h-3" />
                              Group
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(target.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            target.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {target.isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Active (Broadcasting)
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              Disabled (No messages)
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {target._count?.broadcastLogs || 0} posts sent
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(target.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove Target"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

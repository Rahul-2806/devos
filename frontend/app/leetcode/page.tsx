"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, RefreshCw, Mail, BarChart2, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_MODULE3_URL || "http://localhost:8003";

type ScheduleItem = {
  id: string;
  problem: { title: string; slug: string; difficulty: string; topics: string[] };
  retention: number;
  next_review: string;
  interval_days: number;
  overdue: boolean;
};

function RetentionBadge({ val }: { val: number }) {
  const pct = Math.round(val * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>
      {pct}%
    </span>
  );
}

function DiffBadge({ d }: { d: string }) {
  const c = d === "Easy" ? "#22c55e" : d === "Medium" ? "#f59e0b" : "#ef4444";
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${c}15`, color: c }}>{d}</span>
  );
}

export default function LeetCodePage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [weakPatterns, setWeakPatterns] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [syncedUser, setSyncedUser] = useState("");

  const handleSync = async () => {
    if (!username.trim()) return;
    setSyncing(true);
    try {
      await fetch(`${API}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leetcode_username: username, email }),
      });
      setSyncedUser(username);
      await loadData(username);
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async (user: string) => {
    setLoading(true);
    try {
      const [sc, hm, wp] = await Promise.all([
        fetch(`${API}/schedule/${user}?limit=20`).then((r) => r.json()),
        fetch(`${API}/heatmap/${user}`).then((r) => r.json()),
        fetch(`${API}/weak-patterns/${user}`).then((r) => r.json()),
      ]);
      setSchedule(sc.schedule || []);
      setHeatmap(hm);
      setWeakPatterns(wp.weak_patterns || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email || !syncedUser) return;
    await fetch(`${API}/send-review-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: syncedUser, email }),
    });
    setEmailSent(true);
  };

  const handleUpdateReview = async (id: string, perf: number) => {
    await fetch(`${API}/review/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: syncedUser, problem_id: id, performance: perf }),
    });
    await loadData(syncedUser);
  };

  const overdue = schedule.filter((s) => s.overdue);
  const upcoming = schedule.filter((s) => !s.overdue);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-2">
          <BookOpen size={18} className="text-[#f59e0b]" />
          <span className="font-semibold text-slate-100">LeetCode Intelligence Tracker</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Setup */}
        <div className="devos-card p-6 mb-8">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Connect your LeetCode account</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="LeetCode username"
              className="bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#f59e0b]/40"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email for daily nudges (optional)"
              className="bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#f59e0b]/40"
            />
            <button
              onClick={handleSync}
              disabled={syncing || !username}
              className="py-2.5 rounded-xl bg-[#f59e0b] text-[#0a0a0f] font-semibold text-sm hover:bg-[#d97706] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncing ? <><RefreshCw size={14} className="animate-spin" /> Syncing...</> : "Sync Submissions"}
            </button>
          </div>
          {syncedUser && email && (
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSendEmail}
                className="flex items-center gap-2 text-xs text-[#f59e0b] hover:text-[#d97706] transition-colors"
              >
                <Mail size={12} />
                Send today&apos;s review email
              </button>
              {emailSent && <span className="text-xs text-[#22c55e] flex items-center gap-1"><CheckCircle2 size=  {11} /> Sent!</span>}
            </div>
          )}
        </div>

        {loading && (
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => <div key={i} className="devos-card h-24 shimmer" />)}
          </div>
        )}

        {heatmap && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="devos-card p-4">
                <div className="text-2xl font-bold text-[#f59e0b] mb-1">{heatmap.total}</div>
                <div className="text-xs text-slate-500">Problems solved</div>
              </div>
              <div className="devos-card p-4">
                <div className="text-2xl font-bold text-[#ef4444] mb-1">{overdue.length}</div>
                <div className="text-xs text-slate-500">Due for review</div>
              </div>
              <div className="devos-card p-4">
                <div className="text-2xl font-bold text-[#22c55e] mb-1">{upcoming.length}</div>
                <div className="text-xs text-slate-500">On schedule</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Difficulty breakdown */}
              <div className="devos-card p-5">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">Difficulty breakdown</h4>
                {Object.entries(heatmap.difficulty_breakdown).map(([diff, count]) => {
                  const color = diff === "Easy" ? "#22c55e" : diff === "Medium" ? "#f59e0b" : "#ef4444";
                  const total = heatmap.total || 1;
                  return (
                    <div key={diff} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color }}>{diff}</span>
                        <span className="text-slate-400">{count as number}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((count as number) / total) * 100}%` }}
                          transition={{ duration: 1 }}
                          className="h-full rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weak patterns */}
              <div className="devos-card p-5">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">Weak topics (lowest retention)</h4>
                <div className="space-y-2">
                  {weakPatterns.slice(0, 6).map((wp) => (
                    <div key={wp.topic} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {wp.needs_review && <AlertCircle size={11} className="text-[#f59e0b]" />}
                        <span className="text-xs text-slate-300">{wp.topic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{wp.problem_count}p</span>
                        <RetentionBadge val={wp.avg_retention} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Review queue */}
            {overdue.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-[#ef4444]" />
                  Due for review ({overdue.length})
                </h4>
                <div className="space-y-2">
                  {overdue.map((item) => (
                    <div key={item.id} className="devos-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <DiffBadge d={item.problem?.difficulty || "Medium"} />
                        <a
                          href={`https://leetcode.com/problems/${item.problem?.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-200 hover:text-[#f59e0b] transition-colors"
                        >
                          {item.problem?.title}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <RetentionBadge val={item.retention} />
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((p) => (
                            <button
                              key={p}
                              onClick={() => handleUpdateReview(item.id, p)}
                              className="w-6 h-6 rounded text-[10px] border border-white/[0.08] hover:border-[#f59e0b]/40 text-slate-500 hover:text-[#f59e0b] transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 mt-2">Rate 1-5 after reviewing (1=blackout, 5=perfect)</p>
              </div>
            )}
          </>
        )}

        {!syncedUser && (
          <div className="text-center py-16 text-slate-600">
            <BookOpen size={40} className="mx-auto mb-4 opacity-40" />
            <p className="text-sm">Enter your LeetCode username and sync to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

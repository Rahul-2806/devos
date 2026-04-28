"use client";

import { useEffect, useState } from "react";

const MODULE6_URL = process.env.NEXT_PUBLIC_MODULE6_URL || "https://RAHULSR2806-devos-module6-agent.hf.space";

interface Review {
  id: number;
  repo: string;
  pr_number: number;
  pr_title: string;
  risk_score: number;
  security_severity: string;
  perf_severity: string;
  read_severity: string;
  security_issues: string;
  performance_issues: string;
  readability_issues: string;
  reviewed_at: string;
}

interface Stats {
  total: number;
  avg_risk: number;
  blocked: number;
  approved: number;
  reviewed: number;
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
      🔴 {score} Block
    </span>
  );
  if (score >= 40) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      🟡 {score} Review
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      🟢 {score} Approve
    </span>
  );
}

function SeverityPill({ label, severity }: { label: string; severity: string }) {
  const color =
    severity === "CRITICAL" ? "text-red-400 border-red-500/20 bg-red-500/10" :
    severity === "HIGH"     ? "text-orange-400 border-orange-500/20 bg-orange-500/10" :
    severity === "MEDIUM"   ? "text-yellow-400 border-yellow-500/20 bg-yellow-500/10" :
                              "text-slate-400 border-slate-500/20 bg-slate-500/10";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${color}`}>
      {label}: {severity}
    </span>
  );
}

export default function AgentPage() {
  const [reviews, setReviews]       = useState<Review[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [manualRepo, setManualRepo] = useState("");
  const [manualPR, setManualPR]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState("");
  const [selected, setSelected]     = useState<Review | null>(null);

  const fetchData = async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`${MODULE6_URL}/reviews`),
        fetch(`${MODULE6_URL}/reviews/stats`),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      setReviews(rData.reviews || []);
      setStats(sData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const submitManual = async () => {
    if (!manualRepo || !manualPR) return;
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch(`${MODULE6_URL}/review/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: manualRepo, pr_number: parseInt(manualPR) }),
      });
      const data = await res.json();
      setSubmitMsg(data.status || "Queued!");
      setTimeout(() => { fetchData(); setSubmitMsg(""); }, 8000);
    } catch {
      setSubmitMsg("Error — check repo and PR number");
    } finally {
      setSubmitting(false);
    }
  };

  const parseIssues = (raw: string): string[] => {
    try { return JSON.parse(raw) || []; }
    catch { return []; }
  };

  return (
    <div className="min-h-screen bg-[#0D0D14] text-slate-100 p-6 font-mono">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">DevOS v2 · Module 6</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Autonomous PR Review Agent
          </h1>
          <p className="text-sm text-slate-400">
            LangGraph · 3 AI agents in parallel · Security · Performance · Readability
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Total PRs Reviewed", value: stats.total, color: "text-purple-400" },
              { label: "Avg Risk Score",     value: `${stats.avg_risk}/100`, color: "text-yellow-400" },
              { label: "Blocked",            value: stats.blocked, color: "text-red-400" },
              { label: "Approved",           value: stats.approved, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="bg-[#13131E] border border-slate-800 rounded-xl p-4">
                <div className={`text-2xl font-bold ${s.color} mb-1`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Manual Trigger */}
        <div className="bg-[#13131E] border border-slate-800 rounded-xl p-5 mb-8">
          <div className="text-xs text-slate-500 tracking-widest uppercase mb-3">Manual Review Trigger</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 bg-[#0D0D14] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              placeholder="owner/repo (e.g. Rahul-2806/devos)"
              value={manualRepo}
              onChange={e => setManualRepo(e.target.value)}
            />
            <input
              className="w-28 bg-[#0D0D14] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              placeholder="PR #"
              value={manualPR}
              onChange={e => setManualPR(e.target.value)}
            />
            <button
              onClick={submitManual}
              disabled={submitting || !manualRepo || !manualPR}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? "Queuing..." : "Review PR"}
            </button>
          </div>
          {submitMsg && (
            <div className="mt-2 text-xs text-purple-400">{submitMsg} — results appear in ~30s</div>
          )}
        </div>

        {/* Reviews Table */}
        <div className="bg-[#13131E] border border-slate-800 rounded-xl overflow-hidden mb-6">
          <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 tracking-widest uppercase">PR Review History</span>
            <button onClick={fetchData} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ↺ Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-600 text-sm">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center text-slate-600 text-sm">
              No reviews yet. Set up the GitHub webhook or trigger a manual review above.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {reviews.map(r => (
                <div
                  key={r.id}
                  className="px-5 py-4 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(selected?.id === r.id ? null : r)}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">{r.repo}</span>
                        <span className="text-xs text-slate-600">#{r.pr_number}</span>
                      </div>
                      <div className="text-sm text-slate-200 truncate">{r.pr_title || "Untitled PR"}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <RiskBadge score={r.risk_score} />
                      <span className="text-xs text-slate-600">
                        {new Date(r.reviewed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selected?.id === r.id && (
                    <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { label: "🔐 Security",    severity: r.security_severity,  issues: parseIssues(r.security_issues) },
                        { label: "⚡ Performance", severity: r.perf_severity,      issues: parseIssues(r.performance_issues) },
                        { label: "📖 Readability", severity: r.read_severity,      issues: parseIssues(r.readability_issues) },
                      ].map(section => (
                        <div key={section.label} className="bg-[#0D0D14] rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-300">{section.label}</span>
                            <SeverityPill label="" severity={section.severity} />
                          </div>
                          {section.issues.length === 0 ? (
                            <div className="text-xs text-green-400">✅ No issues</div>
                          ) : (
                            <ul className="space-y-1">
                              {section.issues.slice(0, 3).map((issue, i) => (
                                <li key={i} className="text-xs text-slate-400 flex gap-1">
                                  <span className="text-slate-600 flex-shrink-0">·</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhook Setup Guide */}
        <div className="bg-[#13131E] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 tracking-widest uppercase mb-3">GitHub Webhook Setup</div>
          <ol className="space-y-2 text-xs text-slate-400">
            <li className="flex gap-2"><span className="text-purple-400">1.</span> Go to your GitHub repo → Settings → Webhooks → Add webhook</li>
            <li className="flex gap-2"><span className="text-purple-400">2.</span> Payload URL: <code className="text-purple-300 bg-purple-500/10 px-1 rounded">https://RAHULSR2806-devos-module6-agent.hf.space/webhook/github</code></li>
            <li className="flex gap-2"><span className="text-purple-400">3.</span> Content type: <code className="text-purple-300 bg-purple-500/10 px-1 rounded">application/json</code></li>
            <li className="flex gap-2"><span className="text-purple-400">4.</span> Secret: your <code className="text-purple-300 bg-purple-500/10 px-1 rounded">GITHUB_WEBHOOK_SECRET</code> value</li>
            <li className="flex gap-2"><span className="text-purple-400">5.</span> Events: select <code className="text-purple-300 bg-purple-500/10 px-1 rounded">Pull requests</code> only</li>
            <li className="flex gap-2"><span className="text-purple-400">6.</span> Open any PR in that repo — the AI reviews it automatically in ~30s</li>
          </ol>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Github, FileDown, Search, TrendingUp,
  Star, GitFork, AlertCircle, CheckCircle2, Loader2, ChevronRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = process.env.NEXT_PUBLIC_MODULE5_URL || "http://localhost:8005";

type Snapshot = {
  snapshot_id: string;
  profile: { username: string; avatar_url: string; bio: string; location: string; followers: number };
  stats: { total_repos: number; total_stars: number; total_forks: number; contribution_streak: number };
  languages: Record<string, number>;
  top_repos: Array<{ name: string; description: string; language: string; stars: number; url: string }>;
  inferred_skills: string[];
};

type JDAnalysis = {
  analysis_id: string;
  match_score: number;
  required_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  recommendations: string[];
  verdict: string;
};

const LANG_COLORS: Record<string, string> = {
  Python: "#3572A5", TypeScript: "#2b7489", JavaScript: "#f1e05a",
  Dart: "#00B4AB", "C++": "#f34b7d", Java: "#b07219",
  Go: "#00ADD8", Rust: "#dea584", CSS: "#563d7c", HTML: "#e34c26",
};

function MatchMeter({ score, verdict }: { score: number; verdict: string }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = verdict === "strong" ? "Strong match" : verdict === "moderate" ? "Moderate match" : "Needs work";
  return (
    <div className="devos-card p-6 text-center">
      <div className="text-5xl font-bold mb-2" style={{ color }}>{score}%</div>
      <div className="text-sm font-medium mb-3" style={{ color }}>{label}</div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

export default function CareerPage() {
  const [username, setUsername] = useState("Rahul-2806");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [jdText, setJdText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [jdAnalyzing, setJdAnalyzing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!username.trim()) return;
    setAnalyzing(true);
    setSnapshot(null);
    setJdAnalysis(null);
    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_username: username }),
      });
      const data = await res.json();
      setSnapshot(data);
    } catch {
      alert("Failed to fetch GitHub data. Check the API is running.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleJDAnalysis = async () => {
    if (!jdText.trim() || !username) return;
    setJdAnalyzing(true);
    try {
      const res = await fetch(`${API}/jd-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          github_username: username,
          jd_text: jdText,
          company_name: company,
          role_title: role,
        }),
      });
      const data = await res.json();
      setJdAnalysis(data);
    } finally {
      setJdAnalyzing(false);
    }
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API}/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          github_username: username,
          jd_analysis_id: jdAnalysis?.analysis_id,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devos-career-report-${username}.pdf`;
      a.click();
    } finally {
      setPdfLoading(false);
    }
  };

  const langData = snapshot
    ? Object.entries(snapshot.languages)
        .slice(0, 8)
        .map(([lang, count]) => ({ lang, count }))
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-2">
          <BarChart3 size={18} className="text-[#8b5cf6]" />
          <span className="font-semibold text-slate-100">Career Analytics</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* GitHub input */}
        <div className="devos-card p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Github size={16} className="text-[#8b5cf6]" /> Analyze GitHub Profile
          </h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Github size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="GitHub username"
                className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]/40"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-6 py-2.5 rounded-xl bg-[#8b5cf6] text-white text-sm font-medium hover:bg-[#7c3aed] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {snapshot && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Profile + Stats */}
              <div className="grid md:grid-cols-5 gap-4">
                <div className="md:col-span-2 devos-card p-5 flex items-center gap-4">
                  {snapshot.profile.avatar_url && (
                    <img
                      src={snapshot.profile.avatar_url}
                      alt={snapshot.profile.username}
                      className="w-16 h-16 rounded-full border-2 border-white/10"
                    />
                  )}
                  <div>
                    <div className="font-bold text-slate-100 text-lg">@{snapshot.profile.username}</div>
                    {snapshot.profile.bio && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{snapshot.profile.bio}</p>}
                    {snapshot.profile.location && <p className="text-xs text-slate-500 mt-1">📍 {snapshot.profile.location}</p>}
                    <p className="text-xs text-slate-500 mt-1">{snapshot.profile.followers} followers</p>
                  </div>
                </div>

                {[
                  { label: "Repositories", value: snapshot.stats.total_repos, color: "#8b5cf6", icon: Github },
                  { label: "Total Stars", value: snapshot.stats.total_stars, color: "#f59e0b", icon: Star },
                  { label: "Active Days", value: snapshot.stats.contribution_streak, color: "#22c55e", icon: TrendingUp },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="devos-card p-5 flex flex-col justify-between">
                      <Icon size={18} style={{ color: s.color }} />
                      <div>
                        <div className="text-3xl font-bold mt-2" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Languages chart */}
              {langData.length > 0 && (
                <div className="devos-card p-5">
                  <h4 className="text-sm font-semibold text-slate-200 mb-4">Language Distribution</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={langData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="lang" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {langData.map((entry) => (
                          <Cell key={entry.lang} fill={LANG_COLORS[entry.lang] || "#8b5cf6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Repos */}
              {snapshot.top_repos.length > 0 && (
                <div className="devos-card p-5">
                  <h4 className="text-sm font-semibold text-slate-200 mb-4">Top Repositories</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {snapshot.top_repos.slice(0, 6).map((repo) => (
                      <a
                        key={repo.name}
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">{repo.name}</div>
                          {repo.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{repo.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            {repo.language && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ background: `${LANG_COLORS[repo.language] || "#8b5cf6"}20`, color: LANG_COLORS[repo.language] || "#8b5cf6" }}
                              >
                                {repo.language}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Star size={9} /> {repo.stars}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 mt-1 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Inferred Skills */}
              {snapshot.inferred_skills.length > 0 && (
                <div className="devos-card p-5">
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">Inferred Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {snapshot.inferred_skills.slice(0, 30).map((skill) => (
                      <span key={skill} className="text-xs px-2.5 py-1 rounded-full bg-[#8b5cf6]/10 text-[#a78bfa] border border-[#8b5cf6]/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* JD Analysis */}
              <div className="devos-card p-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">Job Description Gap Analysis</h4>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name (optional)"
                    className="bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]/40"
                  />
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Role title (optional)"
                    className="bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]/40"
                  />
                </div>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={5}
                  className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]/40 resize-none mb-3"
                />
                <button
                  onClick={handleJDAnalysis}
                  disabled={jdAnalyzing || !jdText.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#8b5cf6] text-white font-medium text-sm hover:bg-[#7c3aed] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {jdAnalyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : "Run Gap Analysis"}
                </button>
              </div>

              {/* JD Results */}
              <AnimatePresence>
                {jdAnalysis && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <MatchMeter score={jdAnalysis.match_score} verdict={jdAnalysis.verdict} />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="devos-card p-5">
                        <h4 className="text-xs font-semibold text-[#22c55e] mb-3 flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> Matched skills ({jdAnalysis.matched_skills.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {jdAnalysis.matched_skills.map((s) => (
                            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">{s}</span>
                          ))}
                        </div>
                      </div>

                      <div className="devos-card p-5">
                        <h4 className="text-xs font-semibold text-[#ef4444] mb-3 flex items-center gap-1.5">
                          <AlertCircle size={12} /> Missing skills ({jdAnalysis.missing_skills.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {jdAnalysis.missing_skills.map((s) => (
                            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {jdAnalysis.recommendations.length > 0 && (
                      <div className="devos-card p-5">
                        <h4 className="text-sm font-semibold text-slate-200 mb-3">Recommendations</h4>
                        <ol className="space-y-2">
                          {jdAnalysis.recommendations.map((r, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-400">
                              <span className="w-5 h-5 rounded-full bg-[#8b5cf6]/20 text-[#a78bfa] flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">{i + 1}</span>
                              {r}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PDF Export */}
              <div className="flex justify-end">
                <button
                  onClick={handlePDF}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:border-[#8b5cf6]/40 hover:text-[#a78bfa] transition-colors disabled:opacity-50"
                >
                  {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  Download PDF Report
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!snapshot && !analyzing && (
          <div className="text-center py-20 text-slate-600">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Enter a GitHub username and click Analyze</p>
          </div>
        )}
      </div>
    </div>
  );
}

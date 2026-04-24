"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, Shield, Zap, AlertTriangle, CheckCircle, ChevronDown, Search, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

const API = process.env.NEXT_PUBLIC_MODULE1_URL || "http://localhost:8001";

type Review = {
  id: string;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  author: string;
  diff_summary: string;
  security_score: number;
  quality_score: number;
  complexity_score: number;
  issues: Array<{ severity: string; type: string; description: string }>;
  suggestions: Array<{ title: string; description: string }>;
  created_at: string;
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
  };
  const color = map[severity] || "#64748b";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: `${color}20`, color }}>
      {severity}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);

  const avgScore = Math.round((review.security_score + review.quality_score + review.complexity_score) / 3);
  const scoreColor = avgScore >= 80 ? "#22c55e" : avgScore >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="devos-card overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 font-mono">{review.repo_name} #{review.pr_number}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">{review.author}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100 truncate">{review.pr_title}</h3>
            <p className="text-xs text-slate-500 mt-1">{review.diff_summary}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="text-2xl font-bold" style={{ color: scoreColor }}>{avgScore}</div>
            <div className="text-[10px] text-slate-500">avg score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <ScoreBar label="Security" score={review.security_score} color="#22c55e" />
          <ScoreBar label="Quality" score={review.quality_score} color="#3b82f6" />
          <ScoreBar label="Complexity" score={review.complexity_score} color="#f59e0b" />
        </div>

        {review.issues?.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <AlertTriangle size={12} className="text-[#f59e0b]" />
            <span className="text-xs text-slate-400">{review.issues.length} issues found</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? "Hide details" : "View full review"}
        <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-white/[0.06] space-y-4">
              {review.issues?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">Issues</h4>
                  {review.issues.map((issue, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-lg p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={issue.severity} />
                        <span className="text-xs text-slate-500 capitalize">{issue.type}</span>
                      </div>
                      <p className="text-sm text-slate-300">{issue.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {review.suggestions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">Suggestions</h4>
                  {review.suggestions.slice(0, 3).map((s, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-lg p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={12} className="text-[#22c55e]" />
                        <span className="text-sm font-medium text-slate-200">{s.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CodeReviewPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Review[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [rv, st] = await Promise.all([
          fetch(`${API}/reviews?limit=20`).then((r) => r.json()),
          fetch(`${API}/stats`).then((r) => r.json()),
        ]);
        setReviews(rv.reviews || []);
        setStats(st);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API}/reviews/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } finally {
      setSearching(false);
    }
  };

  const displayedReviews = searchResults.length > 0 ? searchResults : reviews;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-[#3b82f6]" />
            <span className="font-semibold text-slate-100">AI Code Review</span>
          </div>
          <a href={`${API}/docs`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            API Docs ↗
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Reviews", value: stats.total, color: "#3b82f6" },
              { label: "Avg Security", value: `${stats.avg_security}/100`, color: "#22c55e" },
              { label: "Avg Quality", value: `${stats.avg_quality}/100`, color: "#8b5cf6" },
              { label: "Issues Found", value: stats.total_issues, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="devos-card p-4">
                <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Setup guide if no reviews */}
        {!loading && reviews.length === 0 && (
          <div className="devos-card p-8 mb-8 text-center">
            <Code2 size={40} className="text-[#3b82f6] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Set up GitHub Webhook</h3>
            <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">
              Connect your GitHub repo to start getting automatic AI reviews on every PR.
            </p>
            <div className="bg-[#0f0f1a] rounded-xl p-4 text-left font-mono text-sm max-w-lg mx-auto">
              <div className="text-slate-400 mb-2"># In your GitHub repo settings:</div>
              <div className="text-slate-200">Settings → Webhooks → Add webhook</div>
              <div className="text-[#3b82f6] mt-2">Payload URL: {API}/webhook/github</div>
              <div className="text-slate-400">Content type: application/json</div>
              <div className="text-slate-400">Event: Pull requests</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Semantic search across all reviews..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
          {searchResults.length > 0 && (
            <button
              onClick={() => { setSearchResults([]); setSearchQuery(""); }}
              className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 text-sm hover:border-white/20 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Reviews list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="devos-card p-5 h-36 shimmer" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedReviews.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No reviews yet. Push a PR to get started.</div>
            ) : (
              displayedReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

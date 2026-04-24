"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Plus, Search, Link2, FileText, Code, Loader2, X, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";

const API = process.env.NEXT_PUBLIC_MODULE2_URL || "http://localhost:8002";

type KnowledgeItem = {
  id: string;
  title: string;
  source_url?: string;
  source_type: string;
  tags: string[];
  created_at: string;
};

type SearchResult = {
  id: string;
  title: string;
  content: string;
  source_url?: string;
  source_type: string;
  tags: string[];
  similarity: number;
};

const SOURCE_ICONS: Record<string, any> = {
  article: Link2,
  code: Code,
  note: FileText,
  paper: FileText,
  video: FileText,
};

function ItemCard({ item, color }: { item: KnowledgeItem; color: string }) {
  const Icon = SOURCE_ICONS[item.source_type] || FileText;
  return (
    <div className="devos-card p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#14b8a6]/10 flex items-center justify-center flex-shrink-0">
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-200 truncate">{item.title}</h4>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-slate-500 border border-white/[0.05]">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<"search" | "add" | "ask">("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Add form
  const [addMode, setAddMode] = useState<"text" | "url">("text");
  const [addContent, setAddContent] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addType, setAddType] = useState("article");
  const [addTags, setAddTags] = useState("");
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Ask
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; sources: any[] } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [iv, st] = await Promise.all([
          fetch(`${API}/items?limit=30`).then((r) => r.json()),
          fetch(`${API}/stats`).then((r) => r.json()),
        ]);
        setItems(iv.items || []);
        setStats(st);
      } catch {}
    };
    load();
  }, [addSuccess]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 8, similarity_threshold: 0.25 }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const endpoint = addMode === "url" ? `${API}/ingest/url` : `${API}/ingest`;
      const body = addMode === "url"
        ? { url: addUrl, tags: addTags.split(",").map((t) => t.trim()).filter(Boolean) }
        : { content: addContent, title: addTitle, source_type: addType, tags: addTags.split(",").map((t) => t.trim()).filter(Boolean) };

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAddSuccess(!addSuccess);
      setAddContent("");
      setAddTitle("");
      setAddUrl("");
      setAddTags("");
    } finally {
      setAdding(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, limit: 5 }),
      });
      const data = await res.json();
      setAnswer(data);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-[#14b8a6]" />
            <span className="font-semibold text-slate-100">Knowledge Graph</span>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span><span className="text-slate-200 font-medium">{stats.total_documents}</span> documents</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="devos-card p-4">
              <div className="text-2xl font-bold text-[#14b8a6] mb-1">{stats.total_documents}</div>
              <div className="text-xs text-slate-500">Total documents</div>
            </div>
            {Object.entries(stats.by_type || {}).slice(0, 3).map(([type, count]) => (
              <div key={type} className="devos-card p-4">
                <div className="text-2xl font-bold text-slate-100 mb-1">{count as number}</div>
                <div className="text-xs text-slate-500 capitalize">{type}s</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 mb-6 border border-white/[0.06] w-fit">
          {(["search", "add", "ask"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? "bg-[#14b8a6] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "search" ? "Search" : t === "add" ? "Add Knowledge" : "Ask AI"}
            </button>
          ))}
        </div>

        {/* Search tab */}
        {tab === "search" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search semantically... e.g. 'database indexing strategies'"
                className="flex-1 bg-[#13131f] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-[#14b8a6] text-white text-sm font-medium hover:bg-[#0d9488] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((r) => (
                  <div key={r.id} className="devos-card p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-100">{r.title}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14b8a6]/10 text-[#14b8a6] ml-2 flex-shrink-0">
                        {Math.round(r.similarity * 100)}% match
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{r.content}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.tags?.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-slate-500">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && items.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Recent documents</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} color="#14b8a6" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add tab */}
        {tab === "add" && (
          <div className="devos-card p-6 max-w-2xl">
            <div className="flex gap-2 mb-5">
              {(["text", "url"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAddMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-sm transition-all capitalize ${
                    addMode === m ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {m === "url" ? "URL / Article" : "Text / Code"}
                </button>
              ))}
            </div>

            {addMode === "url" ? (
              <input
                type="url"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40 mb-3"
              />
            ) : (
              <>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="Title (auto-generated if empty)"
                  className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40 mb-3"
                />
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#14b8a6]/40 mb-3"
                >
                  <option value="article">Article</option>
                  <option value="code">Code</option>
                  <option value="note">Note</option>
                  <option value="paper">Paper</option>
                </select>
                <textarea
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder="Paste your content here..."
                  rows={6}
                  className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40 mb-3 resize-none"
                />
              </>
            )}

            <input
              type="text"
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              placeholder="Tags (comma-separated, auto-generated if empty)"
              className="w-full bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40 mb-4"
            />

            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full py-3 rounded-xl bg-[#14b8a6] text-white font-medium text-sm hover:bg-[#0d9488] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Plus size={14} /> Add to Knowledge Base</>}
            </button>
          </div>
        )}

        {/* Ask tab */}
        {tab === "ask" && (
          <div className="max-w-2xl space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="Ask anything about your knowledge base..."
                className="flex-1 bg-[#13131f] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#14b8a6]/40"
              />
              <button
                onClick={handleAsk}
                disabled={asking}
                className="px-5 py-3 rounded-xl bg-[#14b8a6] text-white text-sm font-medium hover:bg-[#0d9488] transition-colors disabled:opacity-50"
              >
                {asking ? <Loader2 size={14} className="animate-spin" /> : "Ask"}
              </button>
            </div>

            {answer && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="devos-card p-6">
                <div className="prose-devos text-sm leading-relaxed mb-4">
                  <ReactMarkdown>{answer.answer}</ReactMarkdown>
                </div>
                {answer.sources?.length > 0 && (
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="text-xs text-slate-500 mb-2">Sources used:</p>
                    <div className="space-y-1.5">
                      {answer.sources.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="w-4 h-4 rounded-full bg-white/[0.05] flex items-center justify-center text-[10px]">{i + 1}</span>
                          {s.title}
                          <span className="text-slate-600">·</span>
                          <span className="text-[#14b8a6]">{Math.round(s.similarity * 100)}% relevant</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2, Brain, BookOpen, BarChart3,
  Github, ArrowRight, Zap, Shield, TrendingUp,
  ChevronRight, Terminal, Eye, Cpu, Layers, Bot
} from "lucide-react";

const modules = [
  {
    id: 1, icon: Code2, name: "AI Code Review",
    tagline: "Your PRs reviewed by LLaMA 70B",
    description: "GitHub webhooks trigger instant AI review of every pull request. Security scores, quality analysis, and suggestions — stored and searchable.",
    color: "#3b82f6", glow: "rgba(59,130,246,0.3)", href: "/code-review",
    stats: [{ label: "Review time", value: "<3s" }, { label: "Accuracy", value: "94%" }],
    tech: ["GitHub Webhooks", "Groq LLaMA 70B", "pgvector"],
  },
  {
    id: 2, icon: Brain, name: "Knowledge Graph",
    tagline: "Your personal AI memory",
    description: "Paste any article, code, or note. Vector embeddings power semantic search across everything you've ever read. Ask questions, get answers.",
    color: "#14b8a6", glow: "rgba(20,184,166,0.3)", href: "/knowledge",
    stats: [{ label: "Search type", value: "Semantic" }, { label: "Latency", value: "<200ms" }],
    tech: ["RAG Pipeline", "pgvector", "Sentence Transformers"],
  },
  {
    id: 3, icon: BookOpen, name: "LeetCode Tracker",
    tagline: "Never forget a problem again",
    description: "ML-powered spaced repetition based on the Ebbinghaus forgetting curve. Daily email nudges with exactly what you're about to forget.",
    color: "#f59e0b", glow: "rgba(245,158,11,0.3)", href: "/leetcode",
    stats: [{ label: "Algorithm", value: "SM-2" }, { label: "Retention", value: "+40%" }],
    tech: ["scikit-learn", "Ebbinghaus Curve", "Resend"],
  },
  {
    id: 4, icon: Eye, name: "Design Vision Chat",
    tagline: "Upload a diagram. Get expert feedback.",
    description: "LLaMA Vision analyzes your architecture diagram — detects bottlenecks, SPoFs, and scaling gaps. Chat with it to improve your design.",
    color: "#f97316", glow: "rgba(249,115,22,0.3)", href: "/design-chat",
    stats: [{ label: "Model", value: "Vision 11B" }, { label: "Analysis", value: "Instant" }],
    tech: ["LLaMA 3.2 Vision", "Supabase Storage", "Framer Motion"],
  },
  {
    id: 5, icon: BarChart3, name: "Career Analytics",
    tagline: "Know exactly where you stand",
    description: "GitHub API feeds your skill growth dashboard. Paste any job description — get a gap analysis with match score and learning recommendations.",
    color: "#8b5cf6", glow: "rgba(139,92,246,0.3)", href: "/career",
    stats: [{ label: "Data source", value: "GitHub API" }, { label: "Output", value: "PDF Report" }],
    tech: ["GitHub API", "D3.js", "ReportLab"],
  },
  {
    id: 6, icon: Bot, name: "PR Review Agent",
    tagline: "3 AI agents review every PR automatically",
    description: "LangGraph multi-agent pipeline watches your repos autonomously. Security, performance, and readability agents converge on a unified verdict — posted as a PR comment without being asked.",
    color: "#a855f7", glow: "rgba(168,85,247,0.3)", href: "/agent",
    stats: [{ label: "Agents", value: "3 parallel" }, { label: "Trigger", value: "Automatic" }],
    tech: ["LangGraph", "GitHub Webhooks", "Supabase"],
  },
];

const terminalLines = [
  { text: "$ devos webhook received: Rahul-2806/devos PR #42", color: "#64748b" },
  { text: "→ Fetching diff... 847 lines changed", color: "#3b82f6" },
  { text: "→ Running LLaMA 3.1 70B analysis...", color: "#8b5cf6" },
  { text: "✓ Security score: 91/100", color: "#22c55e" },
  { text: "✓ Quality score: 88/100", color: "#22c55e" },
  { text: "⚠ Found 2 issues: SQL injection risk", color: "#f59e0b" },
  { text: "✓ Review stored → Supabase (384-dim)", color: "#14b8a6" },
  { text: "✓ Done in 2.4s ↗", color: "#6366f1" },
];

function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  useEffect(() => {
    const delays = [0, 400, 900, 1500, 1800, 2200, 2700, 3100];
    const timers = delays.map((d, i) => setTimeout(() => setVisibleLines(i + 1), d + 300));
    const reset = setInterval(() => {
      setVisibleLines(0);
      delays.forEach((d, i) => { setTimeout(() => setVisibleLines(prev => Math.max(prev, i + 1)), d + 300); });
    }, 7000);
    return () => { timers.forEach(clearTimeout); clearInterval(reset); };
  }, []);

  return (
    <div className="bg-[#080810] rounded-2xl border border-[#1e1e2e] p-5 font-mono text-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
        <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
        <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
        <span className="ml-2 text-slate-500 text-xs">devos — code-review engine</span>
      </div>
      <div className="space-y-1 min-h-[180px]">
        {terminalLines.map((line, i) => (
          <div key={i} className="leading-6 transition-all duration-300"
            style={{ color: line.color, opacity: visibleLines > i ? 1 : 0, transform: visibleLines > i ? "translateX(0)" : "translateX(-8px)" }}>
            {line.text}
          </div>
        ))}
      </div>
      <span className="inline-block w-2 h-4 bg-[#6366f1] animate-pulse mt-1" />
    </div>
  );
}

function ScoreCard({ score, color, label }: { score: number; color: string; label: string }) {
  return (
    <div className="devos-card p-4 text-center">
      <div className="text-2xl font-bold mb-1" style={{ color }}>{score}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="h-1 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function ModuleCard({ mod, index }: { mod: typeof modules[0]; index: number }) {
  const Icon = mod.icon;
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 * index }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <div className="devos-card p-6 h-full flex flex-col transition-all duration-300 cursor-pointer"
        style={hovered ? { borderColor: `${mod.color}50`, boxShadow: `0 0 25px ${mod.glow}` } : {}}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}>
            <Icon size={20} style={{ color: mod.color }} />
          </div>
          <span className="text-xs font-mono px-2 py-1 rounded-full"
            style={{ background: `${mod.color}15`, color: mod.color }}>M{mod.id}</span>
        </div>
        <h3 className="text-base font-semibold text-slate-100 mb-1">{mod.name}</h3>
        <p className="text-sm font-medium mb-3" style={{ color: mod.color }}>{mod.tagline}</p>
        <p className="text-sm text-slate-400 leading-relaxed flex-1">{mod.description}</p>
        <div className="flex gap-3 mt-4 mb-4">
          {mod.stats.map((s) => (
            <div key={s.label} className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center border border-white/[0.05]">
              <div className="text-sm font-bold text-slate-100">{s.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {mod.tech.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06]">{t}</span>
          ))}
        </div>
        <Link href={mod.href}>
          <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: mod.color }}>
            Open module <ChevronRight size={14} />
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="fixed pointer-events-none rounded-full" style={{ width: 600, height: 600, left: "5%", top: "-10%", background: "#6366f1", filter: "blur(140px)", opacity: 0.1 }} />
      <div className="fixed pointer-events-none rounded-full" style={{ width: 500, height: 500, left: "60%", top: "0%", background: "#8b5cf6", filter: "blur(140px)", opacity: 0.1 }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <Cpu size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-100 tracking-tight">DevOS</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {[["Code Review", "/code-review"], ["Knowledge", "/knowledge"], ["LeetCode", "/leetcode"], ["Design Chat", "/design-chat"], ["Career", "/career"], ["PR Agent", "/agent"]].map(([name, href]) => (
              <Link key={name} href={href} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">{name}</Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/Rahul-2806" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-200 transition-colors">
              <Github size={18} />
            </a>
            <Link href="/dashboard">
              <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white hover:opacity-90 transition-opacity">
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 w-full py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 text-[#a5b4fc] text-xs font-medium mb-6">
                <Zap size={12} /> 6 AI modules · One platform · Open source
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                Your AI-Powered<br />
                <span className="gradient-text">Developer OS</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl">
                A unified intelligent platform that makes developers measurably better.
                AI code review, knowledge graph, DSA intelligence, design analysis,
                career analytics, and autonomous PR review — all in one system.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap gap-3 mb-8">
                <Link href="/dashboard">
                  <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-medium text-sm hover:opacity-90 transition-opacity">
                    Launch DevOS <ArrowRight size={16} />
                  </button>
                </Link>
                <a href="https://github.com/Rahul-2806/devos" target="_blank" rel="noopener noreferrer">
                  <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-slate-300 font-medium text-sm hover:border-white/20 transition-colors">
                    <Github size={16} /> View Source
                  </button>
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
                className="flex flex-wrap gap-2">
                {["Next.js 15", "FastAPI", "Groq LLaMA 70B", "pgvector", "Supabase", "Docker", "Python 3.11", "LangGraph", "Framer Motion", "scikit-learn", "Resend"].map((badge) => (
                  <span key={badge} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-500 border border-white/[0.06]">{badge}</span>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
              <TerminalDemo />
              <div className="grid grid-cols-3 gap-3 mt-4">
                <ScoreCard score={91} color="#22c55e" label="Security" />
                <ScoreCard score={88} color="#3b82f6" label="Quality" />
                <ScoreCard score={76} color="#f59e0b" label="Complexity" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="py-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-slate-400 text-xs mb-4">
              <Layers size={12} /> Six integrated modules
            </div>
            <h2 className="text-4xl font-bold text-slate-100 mb-4">Everything a developer needs</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Each module is independent and powerful on its own. Together, they form a complete development intelligence system.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((mod, i) => <ModuleCard key={mod.id} mod={mod} index={i} />)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Secure by design", desc: "GitHub webhook signature verification, Supabase RLS, service keys never exposed to frontend.", color: "#22c55e" },
              { icon: TrendingUp, title: "Scales with you", desc: "Microservice architecture — each module deploys independently. pgvector handles millions of embeddings.", color: "#3b82f6" },
              { icon: Terminal, title: "Fully containerized", desc: "Docker Compose for local dev. Render + Vercel for production. One command to run everything.", color: "#8b5cf6" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }} className="devos-card p-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${item.color}15` }}>
                    <Icon size={20} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-semibold text-slate-100 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="devos-card p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/10 pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-6">
                <Cpu size={28} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-100 mb-4">Ready to level up?</h2>
              <p className="text-slate-400 mb-8">DevOS is open source. Star it, fork it, and make it yours.</p>
              <Link href="/dashboard">
                <button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold hover:opacity-90 transition-opacity">
                  Launch DevOS <ArrowRight size={16} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <Cpu size={12} className="text-white" />
            </div>
            <span className="text-sm font-medium text-slate-300">DevOS</span>
            <span className="text-slate-600 text-sm">by</span>
            <a href="https://rahulaiportfolio.online" target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] hover:text-[#8b5cf6] transition-colors">Rahul</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Rahul-2806" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
              <Github size={14} /> GitHub
            </a>
            <a href="https://rahulaiportfolio.online" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Portfolio</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
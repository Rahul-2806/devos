"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Code2, Brain, BookOpen, Eye, BarChart3, ArrowRight, Activity, CheckCircle2, Clock, Bot } from "lucide-react";

const modules = [
  {
    id: 1, icon: Code2, name: "AI Code Review", href: "/code-review",
    color: "#3b82f6", bg: "rgba(59,130,246,0.1)",
    desc: "Review your PR history, search past reviews, trigger manual reviews",
    status: "live",
  },
  {
    id: 2, icon: Brain, name: "Knowledge Graph", href: "/knowledge",
    color: "#14b8a6", bg: "rgba(20,184,166,0.1)",
    desc: "Add articles, search your knowledge base, ask AI about what you've saved",
    status: "live",
  },
  {
    id: 3, icon: BookOpen, name: "LeetCode Tracker", href: "/leetcode",
    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",
    desc: "Sync your submissions, see what to review today, track weak topics",
    status: "live",
  },
  {
    id: 4, icon: Eye, name: "Design Vision Chat", href: "/design-chat",
    color: "#f97316", bg: "rgba(249,115,22,0.1)",
    desc: "Upload architecture diagrams, get AI feedback, improve your designs",
    status: "live",
  },
  {
    id: 5, icon: BarChart3, name: "Career Analytics", href: "/career",
    color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",
    desc: "Analyze GitHub profile, paste job descriptions, download PDF reports",
    status: "live",
  },
  {
    id: 6, icon: Bot, name: "PR Review Agent", href: "/agent",
    color: "#a855f7", bg: "rgba(168,85,247,0.1)",
    desc: "LangGraph multi-agent pipeline — autonomously reviews every PR for security, performance and readability",
    status: "live",
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-slate-100">DevOS</Link>
          <div className="flex items-center gap-1.5 text-xs text-[#22c55e]">
            <Activity size={12} />
            All systems operational
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
          <p className="text-slate-400">Your 6 AI modules, ready to use</p>
        </motion.div>

        {/* Module grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link href={mod.href}>
                  <div className="devos-card p-6 cursor-pointer group h-full flex flex-col hover:border-white/20 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: mod.bg }}
                      >
                        <Icon size={22} style={{ color: mod.color }} />
                      </div>
                      <CheckCircle2 size={14} className="text-[#22c55e] mt-1" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mb-2">{mod.name}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed flex-1">{mod.desc}</p>
                    <div
                      className="flex items-center gap-1.5 text-sm font-medium mt-4 group-hover:gap-2.5 transition-all"
                      style={{ color: mod.color }}
                    >
                      Open <ArrowRight size={14} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}

          {/* Quick start card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.56 }}
            className="devos-card p-6 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <Clock size={22} className="text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Quick Start Guide</h3>
              <div className="space-y-2.5">
                {[
                  { step: "1", text: "Set up GitHub webhook → Module 1", done: false },
                  { step: "2", text: "Add your first article → Module 2", done: false },
                  { step: "3", text: "Sync LeetCode username → Module 3", done: false },
                  { step: "4", text: "Upload a system diagram → Module 4", done: false },
                  { step: "5", text: "Analyze GitHub profile → Module 5", done: false },
                  { step: "6", text: "Connect repo → PR Agent webhook", done: false },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-2.5 text-sm text-slate-400">
                    <span className="w-5 h-5 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-[10px] text-slate-500 flex-shrink-0">
                      {item.step}
                    </span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
            <a
              href="https://github.com/Rahul-2806/devos#local-setup"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#6366f1] mt-4 hover:text-[#8b5cf6] transition-colors"
            >
              Read setup guide <ArrowRight size={13} />
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
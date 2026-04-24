"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Upload, Send, AlertTriangle, ShieldAlert, Zap, Star, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";

const API = process.env.NEXT_PUBLIC_MODULE4_URL || "http://localhost:8004";

type Analysis = {
  components_detected: Array<{ name: string; type: string; description: string }>;
  bottlenecks: Array<{ location: string; severity: string; description: string; fix: string }>;
  spof_list: Array<{ component: string; impact: string; mitigation: string }>;
  overall_score: number;
  strengths: string[];
  missing_components: string[];
  scalability_assessment: string;
  security_gaps: string[];
  summary: string;
};

type Message = { role: "user" | "assistant"; content: string };

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e1e2e" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ transformOrigin: "50px 50px", transform: "rotate(-90deg)" }}
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="18" fontWeight="700">{score}</text>
        <text x="50" y="64" textAnchor="middle" fill="#64748b" fontSize="10">/100</text>
      </svg>
      <span className="text-xs text-slate-400 mt-1">Design Score</span>
    </div>
  );
}

export default function DesignChatPage() {
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("My System Design");
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setAnalysis(null);
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);

    try {
      const res = await fetch(`${API}/analyze`, { method: "POST", body: formData });
      const data = await res.json();
      setDiagramId(data.diagram_id);
      setAnalysis(data.analysis);
      setMessages([{
        role: "assistant",
        content: `I've analyzed your system design.\n\n**Score: ${data.analysis.overall_score}/100**\n\n${data.analysis.summary}\n\nDetected **${data.analysis.components_detected?.length || 0} components**, **${data.analysis.bottlenecks?.length || 0} bottlenecks**, and **${data.analysis.spof_list?.length || 0} single points of failure**.\n\nAsk me anything about improving this architecture!`,
      }]);
    } catch {
      setMessages([{ role: "assistant", content: "Failed to analyze the image. Please try again." }]);
    } finally {
      setUploading(false);
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [] }, maxFiles: 1,
  });

  const handleChat = async () => {
    if (!chatInput.trim() || !diagramId) return;
    const userMsg: Message = { role: "user", content: chatInput };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setSending(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagram_id: diagramId, message: chatInput, chat_history: messages }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-2">
          <Eye size={18} className="text-[#f97316]" />
          <span className="font-semibold text-slate-100">System Design Vision Chat</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Upload + Analysis */}
          <div className="lg:col-span-2 space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Diagram title"
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#f97316]/40"
            />

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragActive ? "border-[#f97316]/60 bg-[#f97316]/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="text-[#f97316] animate-spin" />
                  <p className="text-sm text-slate-400">Analyzing with LLaMA Vision...</p>
                </div>
              ) : preview ? (
                <div>
                  <img src={preview} alt="Diagram" className="max-h-48 mx-auto rounded-lg object-contain mb-2" />
                  <p className="text-xs text-slate-500">Drop a new image to re-analyze</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className="text-slate-500" />
                  <p className="text-sm text-slate-400">Drop your architecture diagram here</p>
                  <p className="text-xs text-slate-600">PNG, JPG, WebP · Screenshots, whiteboard photos welcome</p>
                </div>
              )}
            </div>

            {analysis && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="devos-card p-5 flex items-center gap-6">
                  <ScoreCircle score={analysis.overall_score} />
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                        {analysis.components_detected?.length || 0} components
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#ef4444]/10 text-[#ef4444]">
                        {analysis.bottlenecks?.length || 0} bottlenecks
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{analysis.summary}</p>
                  </div>
                </div>

                {analysis.bottlenecks?.length > 0 && (
                  <div className="devos-card p-4">
                    <h4 className="text-xs font-semibold text-[#f97316] mb-3 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Bottlenecks
                    </h4>
                    {analysis.bottlenecks.slice(0, 3).map((b, i) => (
                      <div key={i} className="mb-2 last:mb-0">
                        <div className="text-xs font-medium text-slate-200">{b.location}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{b.description}</div>
                        <div className="text-[11px] text-[#22c55e] mt-0.5">Fix: {b.fix}</div>
                      </div>
                    ))}
                  </div>
                )}

                {analysis.strengths?.length > 0 && (
                  <div className="devos-card p-4">
                    <h4 className="text-xs font-semibold text-[#22c55e] mb-3 flex items-center gap-1.5">
                      <Star size={12} /> Strengths
                    </h4>
                    {analysis.strengths.slice(0, 3).map((s, i) => (
                      <div key={i} className="text-[11px] text-slate-400 mb-1">· {s}</div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Right: Chat */}
          <div className="lg:col-span-3 devos-card flex flex-col" style={{ minHeight: "600px" }}>
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                <span className="text-sm text-slate-300">Architecture AI</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Eye size={40} className="text-slate-700 mb-4" />
                  <p className="text-sm text-slate-500">Upload a diagram to start chatting</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {["How do I scale this to 10M users?", "What are the single points of failure?", "How would Netflix design this differently?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setChatInput(q)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#f97316] text-white"
                        : "bg-[#13131f] border border-white/[0.06] text-slate-200"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose-devos">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <Loader2 size={14} className="animate-spin text-[#f97316]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/[0.06]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChat()}
                  placeholder={diagramId ? "Ask about this architecture..." : "Upload a diagram first"}
                  disabled={!diagramId || sending}
                  className="flex-1 bg-[#0f0f1a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#f97316]/40 disabled:opacity-50"
                />
                <button
                  onClick={handleChat}
                  disabled={!diagramId || sending || !chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#f97316] text-white hover:bg-[#ea6c12] transition-colors disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

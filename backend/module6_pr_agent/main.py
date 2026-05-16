import os
import json
import hmac
import hashlib
import asyncio
from typing import TypedDict, Annotated, List
from datetime import datetime

import httpx
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from supabase import create_client, Client
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

# ── ENV ──────────────────────────────────────────────────────────────
GROQ_API_KEY        = os.environ["GROQ_API_KEY"]
GITHUB_TOKEN        = os.environ["GITHUB_TOKEN"]
GITHUB_WEBHOOK_SECRET = os.environ["GITHUB_WEBHOOK_SECRET"]
SUPABASE_URL        = os.environ["SUPABASE_URL"]
SUPABASE_KEY        = os.environ["SUPABASE_SERVICE_KEY"]

groq_client  = Groq(api_key=GROQ_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="DevOS Agent Module", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LANGGRAPH STATE ───────────────────────────────────────────────────
class AgentState(TypedDict):
    pr_title: str
    pr_body: str
    diff: str
    repo: str
    pr_number: int
    security_review: str
    performance_review: str
    readability_review: str
    final_verdict: str
    risk_score: int          # 0-100
    messages: Annotated[List, add_messages]

# ── GROQ HELPER ───────────────────────────────────────────────────────
def call_groq(system: str, user: str, max_tokens: int = 800) -> str:
    resp = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.2,
    )
    return resp.choices[0].message.content.strip()

# ── AGENT 1: SECURITY ─────────────────────────────────────────────────
def security_agent(state: AgentState) -> AgentState:
    system = """You are an elite security code reviewer. Analyze the PR diff for:
- SQL injection, XSS, CSRF vulnerabilities
- Hardcoded secrets, API keys, passwords
- Insecure dependencies or imports
- Auth/authorization flaws
- Input validation issues

Respond in this exact JSON format:
{
  "issues": ["issue1", "issue2"],
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "score": <0-100 risk score>,
  "recommendation": "one sentence fix"
}
If no issues found, return empty issues array and score 0."""

    user = f"""PR: {state['pr_title']}
Repo: {state['repo']}

DIFF:
{state['diff'][:3000]}"""

    result = call_groq(system, user)
    try:
        parsed = json.loads(result)
        state["security_review"] = json.dumps(parsed)
    except Exception:
        state["security_review"] = json.dumps({
            "issues": [], "severity": "LOW", "score": 0,
            "recommendation": result[:200]
        })
    return state

# ── AGENT 2: PERFORMANCE ──────────────────────────────────────────────
def performance_agent(state: AgentState) -> AgentState:
    system = """You are a performance optimization expert. Analyze the PR diff for:
- Unnecessary loops, O(n²) or worse complexity
- Missing pagination, unbounded queries
- Memory leaks, large object retention
- Blocking I/O without async/await
- Missing caching opportunities
- N+1 query problems

Respond in this exact JSON format:
{
  "issues": ["issue1", "issue2"],
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "score": <0-100 risk score>,
  "recommendation": "one sentence fix"
}"""

    user = f"""PR: {state['pr_title']}
Repo: {state['repo']}

DIFF:
{state['diff'][:3000]}"""

    result = call_groq(system, user)
    try:
        parsed = json.loads(result)
        state["performance_review"] = json.dumps(parsed)
    except Exception:
        state["performance_review"] = json.dumps({
            "issues": [], "severity": "LOW", "score": 0,
            "recommendation": result[:200]
        })
    return state

# ── AGENT 3: READABILITY ─────────────────────────────────────────────
def readability_agent(state: AgentState) -> AgentState:
    system = """You are a code quality and readability expert. Analyze the PR diff for:
- Missing or inadequate comments/docstrings
- Poor variable/function naming
- Functions doing too many things (SRP violations)
- Magic numbers and hardcoded values
- Dead code or commented-out blocks
- Missing error handling

Respond in this exact JSON format:
{
  "issues": ["issue1", "issue2"],
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "score": <0-100 risk score>,
  "recommendation": "one sentence fix"
}"""

    user = f"""PR: {state['pr_title']}
Repo: {state['repo']}

DIFF:
{state['diff'][:3000]}"""

    result = call_groq(system, user)
    try:
        parsed = json.loads(result)
        state["readability_review"] = json.dumps(parsed)
    except Exception:
        state["readability_review"] = json.dumps({
            "issues": [], "severity": "LOW", "score": 0,
            "recommendation": result[:200]
        })
    return state

# ── AGENT 4: VERDICT SYNTHESIZER ─────────────────────────────────────
def verdict_agent(state: AgentState) -> AgentState:
    sec  = json.loads(state["security_review"])
    perf = json.loads(state["performance_review"])
    read = json.loads(state["readability_review"])

    # Weighted risk score: security=50%, performance=30%, readability=20%
    risk = int(sec["score"] * 0.5 + perf["score"] * 0.3 + read["score"] * 0.2)
    state["risk_score"] = risk

    if risk >= 70:
        verdict_emoji = "🔴"
        verdict_label = "BLOCK — Must fix before merge"
    elif risk >= 40:
        verdict_emoji = "🟡"
        verdict_label = "REVIEW — Issues need discussion"
    else:
        verdict_emoji = "🟢"
        verdict_label = "APPROVE — Looks good"

    def format_issues(label, data):
        issues = data.get("issues", [])
        if not issues:
            return f"**{label}** ✅ No issues found"
        lines = "\n".join(f"  - {i}" for i in issues[:4])
        return f"**{label}** ({data['severity']})\n{lines}\n  💡 {data.get('recommendation','')}"

    comment = f"""## 🤖 DevOS AI Code Review

### {verdict_emoji} {verdict_label}
**Risk Score: {risk}/100**

---

{format_issues("🔐 Security", sec)}

{format_issues("⚡ Performance", perf)}

{format_issues("📖 Readability", read)}

---
*Reviewed by DevOS v2 · 3 specialized AI agents · [devos-2806.vercel.app](https://devos-2806.vercel.app)*"""

    state["final_verdict"] = comment
    return state

# ── BUILD LANGGRAPH ───────────────────────────────────────────────────
def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("security",    security_agent)
    graph.add_node("performance", performance_agent)
    graph.add_node("readability", readability_agent)
    graph.add_node("verdict",     verdict_agent)

    # Run all 3 agents in parallel, then converge to verdict
    graph.set_entry_point("security")
    graph.add_edge("security",    "performance")
    graph.add_edge("performance", "readability")
    graph.add_edge("readability", "verdict")
    graph.add_edge("verdict",     END)

    return graph.compile()

pr_agent = build_graph()

# ── GITHUB HELPERS ────────────────────────────────────────────────────
async def get_pr_diff(repo: str, pr_number: int) -> str:
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3.diff",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.text[:8000]
        return ""

async def post_pr_comment(repo: str, pr_number: int, body: str):
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"body": body}, headers=headers)

def save_review_to_db(repo: str, pr_number: int, pr_title: str,
                       risk_score: int, verdict: str,
                       sec: dict, perf: dict, read: dict):
    try:
        supabase.table("pr_reviews").insert({
            "repo":              repo,
            "pr_number":         pr_number,
            "pr_title":          pr_title,
            "risk_score":        risk_score,
            "verdict":           verdict,
            "security_issues":   json.dumps(sec.get("issues", [])),
            "performance_issues":json.dumps(perf.get("issues", [])),
            "readability_issues":json.dumps(read.get("issues", [])),
            "security_severity": sec.get("severity", "LOW"),
            "perf_severity":     perf.get("severity", "LOW"),
            "read_severity":     read.get("severity", "LOW"),
            "reviewed_at":       datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        print(f"DB save error: {e}")

# ── BACKGROUND TASK: RUN AGENTS ───────────────────────────────────────
async def run_pr_review(repo: str, pr_number: int, pr_title: str, pr_body: str):
    diff = await get_pr_diff(repo, pr_number)
    if not diff:
        return

    initial_state: AgentState = {
        "pr_title":           pr_title,
        "pr_body":            pr_body,
        "diff":               diff,
        "repo":               repo,
        "pr_number":          pr_number,
        "security_review":    "",
        "performance_review": "",
        "readability_review": "",
        "final_verdict":      "",
        "risk_score":         0,
        "messages":           [],
    }

    result = pr_agent.invoke(initial_state)

    await post_pr_comment(repo, pr_number, result["final_verdict"])

    save_review_to_db(
        repo, pr_number, pr_title, result["risk_score"],
        result["final_verdict"],
        json.loads(result["security_review"]),
        json.loads(result["performance_review"]),
        json.loads(result["readability_review"]),
    )

# ── WEBHOOK SIGNATURE VERIFY ──────────────────────────────────────────
def verify_signature(payload: bytes, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# ── ROUTES ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "DevOS Agent v2 — LangGraph PR Review Engine", "agents": 3}

@app.post("/webhook/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    payload_bytes = await request.body()
    signature     = request.headers.get("X-Hub-Signature-256", "")

    if not verify_signature(payload_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event   = request.headers.get("X-GitHub-Event", "")
    payload = json.loads(payload_bytes)

    if event == "pull_request" and payload.get("action") in ("opened", "synchronize"):
        pr       = payload["pull_request"]
        repo     = payload["repository"]["full_name"]
        pr_num   = pr["number"]
        pr_title = pr["title"]
        pr_body  = pr.get("body") or ""

        background_tasks.add_task(run_pr_review, repo, pr_num, pr_title, pr_body)
        return {"status": "Review queued", "pr": pr_num, "repo": repo}

    return {"status": "Event ignored", "event": event}

@app.get("/reviews")
def get_reviews(repo: str = None, limit: int = 20):
    query = supabase.table("pr_reviews").select("*").order("reviewed_at", desc=True).limit(limit)
    if repo:
        query = query.eq("repo", repo)
    result = query.execute()
    return {"reviews": result.data}

@app.get("/reviews/stats")
def get_stats():
    result = supabase.table("pr_reviews").select("*").execute()
    reviews = result.data
    if not reviews:
        return {"total": 0, "avg_risk": 0, "blocked": 0, "approved": 0}
    total    = len(reviews)
    avg_risk = round(sum(r["risk_score"] for r in reviews) / total)
    blocked  = sum(1 for r in reviews if r["risk_score"] >= 70)
    approved = sum(1 for r in reviews if r["risk_score"] < 40)
    return {
        "total":    total,
        "avg_risk": avg_risk,
        "blocked":  blocked,
        "approved": approved,
        "reviewed": total - blocked - approved,
    }

@app.post("/review/manual")
async def manual_review(body: dict, background_tasks: BackgroundTasks):
    repo     = body.get("repo")
    pr_num   = body.get("pr_number")
    pr_title = body.get("pr_title", "Manual Review")
    pr_body  = body.get("pr_body", "")

    if not repo or not pr_num:
        raise HTTPException(status_code=400, detail="repo and pr_number required")

    background_tasks.add_task(run_pr_review, repo, int(pr_num), pr_title, pr_body)
    return {"status": "Manual review queued", "pr": pr_num, "repo": repo}

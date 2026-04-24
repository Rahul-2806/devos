"""
DevOS Module 1 — AI Code Review Engine
GitHub webhook receiver → Groq LLaMA review → Supabase storage
"""

import hashlib
import hmac
import json
import os
import re
import sys
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.utils import get_supabase, groq_chat, embed_text, health_response

app = FastAPI(title="DevOS — Code Review Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


# ─────────────────────────────────────────
# Models
# ─────────────────────────────────────────
class ManualReviewRequest(BaseModel):
    repo_name: str
    pr_number: int
    pr_title: str
    pr_url: str
    author: str
    diff: str


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


# ─────────────────────────────────────────
# Webhook Verification
# ─────────────────────────────────────────
def verify_github_signature(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True  # Skip in dev
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ─────────────────────────────────────────
# Core Review Logic
# ─────────────────────────────────────────
def parse_diff_summary(diff: str) -> str:
    lines = diff.split("\n")
    added = sum(1 for l in lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in lines if l.startswith("-") and not l.startswith("---"))
    files = [l for l in lines if l.startswith("diff --git")]
    return f"{len(files)} files changed, {added} additions, {removed} deletions"


def run_ai_review(diff: str, pr_title: str, repo_name: str) -> dict:
    diff_truncated = diff[:8000] if len(diff) > 8000 else diff

    system = """You are an expert senior software engineer at Google doing a thorough code review.
Analyze the git diff provided and return a JSON response with EXACTLY this structure:
{
  "security_score": <0-100, where 100 is perfectly secure>,
  "quality_score": <0-100, where 100 is perfect code quality>,
  "complexity_score": <0-100, where 100 is perfectly simple/readable>,
  "issues": [
    {"severity": "critical|high|medium|low", "type": "security|logic|performance|style", "description": "...", "line_hint": "..."}
  ],
  "suggestions": [
    {"title": "...", "description": "...", "example": "..."}
  ],
  "summary": "2-3 sentence overall assessment",
  "strengths": ["...", "..."],
  "verdict": "approve|request_changes|needs_discussion"
}
Return ONLY valid JSON. No markdown, no preamble."""

    prompt = f"""Repository: {repo_name}
PR Title: {pr_title}

Git Diff:
{diff_truncated}

Review this code thoroughly."""

    raw = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        system=system,
        temperature=0.1,
        max_tokens=2048,
    )

    # Strip markdown fences if present
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()

    try:
        return json.loads(clean)
    except Exception:
        return {
            "security_score": 70,
            "quality_score": 70,
            "complexity_score": 70,
            "issues": [],
            "suggestions": [{"title": "Review complete", "description": raw, "example": ""}],
            "summary": "Review completed.",
            "strengths": [],
            "verdict": "needs_discussion",
        }


def store_review(
    repo_name: str,
    pr_number: int,
    pr_title: str,
    pr_url: str,
    author: str,
    diff_summary: str,
    review: dict,
) -> str:
    supabase = get_supabase()

    review_text = f"{pr_title} {review.get('summary', '')} " + " ".join(
        [i.get("description", "") for i in review.get("issues", [])]
    )
    embedding = embed_text(review_text)

    result = (
        supabase.table("code_reviews")
        .insert(
            {
                "repo_name": repo_name,
                "pr_number": pr_number,
                "pr_title": pr_title,
                "pr_url": pr_url,
                "author": author,
                "diff_summary": diff_summary,
                "security_score": review.get("security_score", 0),
                "quality_score": review.get("quality_score", 0),
                "complexity_score": review.get("complexity_score", 0),
                "issues": review.get("issues", []),
                "suggestions": review.get("suggestions", []),
                "full_review": json.dumps(review),
                "review_embedding": embedding,
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def process_webhook_payload(payload: dict, background: bool = False) -> dict:
    action = payload.get("action", "")
    if action not in ["opened", "synchronize", "reopened"]:
        return {"skipped": True, "reason": f"Action '{action}' not reviewed"}

    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})

    pr_number = pr.get("number", 0)
    pr_title = pr.get("title", "Untitled PR")
    pr_url = pr.get("html_url", "")
    author = pr.get("user", {}).get("login", "unknown")
    repo_name = repo.get("full_name", "unknown/repo")

    # Fetch the actual diff from GitHub
    diff_url = pr.get("diff_url", "")
    diff = ""
    if diff_url:
        import httpx
        token = os.environ.get("GITHUB_TOKEN", "")
        headers = {"Authorization": f"token {token}"} if token else {}
        try:
            resp = httpx.get(diff_url, headers=headers, timeout=15)
            diff = resp.text
        except Exception:
            diff = f"Could not fetch diff for PR #{pr_number}"

    diff_summary = parse_diff_summary(diff)
    review = run_ai_review(diff, pr_title, repo_name)
    review_id = store_review(repo_name, pr_number, pr_title, pr_url, author, diff_summary, review)

    return {
        "success": True,
        "review_id": review_id,
        "pr": f"{repo_name}#{pr_number}",
        "verdict": review.get("verdict"),
        "scores": {
            "security": review.get("security_score"),
            "quality": review.get("quality_score"),
            "complexity": review.get("complexity_score"),
        },
    }


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return health_response("code-review")


@app.post("/webhook/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    event = request.headers.get("X-GitHub-Event", "")

    if not verify_github_signature(payload_bytes, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    if event != "pull_request":
        return {"message": f"Event '{event}' ignored"}

    payload = json.loads(payload_bytes)
    background_tasks.add_task(process_webhook_payload, payload)
    return {"message": "Webhook received, review queued"}


@app.post("/review/manual")
async def manual_review(req: ManualReviewRequest):
    """Trigger a review manually without GitHub webhook"""
    diff_summary = parse_diff_summary(req.diff)
    review = run_ai_review(req.diff, req.pr_title, req.repo_name)
    review_id = store_review(
        req.repo_name, req.pr_number, req.pr_title, req.pr_url,
        req.author, diff_summary, review
    )
    return {"success": True, "review_id": review_id, "review": review}


@app.get("/reviews")
def get_reviews(repo: Optional[str] = None, limit: int = 20, offset: int = 0):
    supabase = get_supabase()
    query = (
        supabase.table("code_reviews")
        .select("id, repo_name, pr_number, pr_title, pr_url, author, diff_summary, security_score, quality_score, complexity_score, issues, suggestions, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if repo:
        query = query.eq("repo_name", repo)
    result = query.execute()
    return {"reviews": result.data, "total": len(result.data)}


@app.get("/reviews/{review_id}")
def get_review(review_id: str):
    supabase = get_supabase()
    result = (
        supabase.table("code_reviews")
        .select("*")
        .eq("id", review_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Review not found")
    return result.data


@app.post("/reviews/search")
def search_reviews(req: SearchRequest):
    supabase = get_supabase()
    query_embedding = embed_text(req.query)
    result = supabase.rpc(
        "search_similar_reviews",
        {"query_embedding": query_embedding, "max_results": req.limit},
    ).execute()
    return {"results": result.data}


@app.get("/stats")
def get_stats():
    supabase = get_supabase()
    reviews = supabase.table("code_reviews").select("security_score, quality_score, complexity_score, issues, created_at").execute()
    data = reviews.data
    if not data:
        return {"total": 0, "avg_security": 0, "avg_quality": 0, "avg_complexity": 0, "total_issues": 0}

    return {
        "total": len(data),
        "avg_security": round(sum(r["security_score"] for r in data) / len(data)),
        "avg_quality": round(sum(r["quality_score"] for r in data) / len(data)),
        "avg_complexity": round(sum(r["complexity_score"] for r in data) / len(data)),
        "total_issues": sum(len(r.get("issues", [])) for r in data),
    }

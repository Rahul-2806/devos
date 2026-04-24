"""
DevOS Module 3 — LeetCode Intelligence Tracker
Scrape submissions → Ebbinghaus ML model → spaced repetition emails
"""

import os
import sys
import json
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import numpy as np
import resend
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.utils import get_supabase, groq_chat, health_response

app = FastAPI(title="DevOS — LeetCode Tracker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

resend.api_key = os.environ.get("RESEND_API_KEY", "")

# ─────────────────────────────────────────
# Models
# ─────────────────────────────────────────
class SyncRequest(BaseModel):
    leetcode_username: str
    email: Optional[str] = None


class UpdateReviewRequest(BaseModel):
    username: str
    problem_id: str
    performance: int  # 1-5 (SM-2 quality rating)


class EmailRequest(BaseModel):
    username: str
    email: str


# ─────────────────────────────────────────
# LeetCode Scraper (via GraphQL API)
# ─────────────────────────────────────────
LEETCODE_GRAPHQL = "https://leetcode.com/graphql"

def fetch_leetcode_profile(username: str) -> dict:
    query = """
    query getUserProfile($username: String!) {
        matchedUser(username: $username) {
            username
            submitStats {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
            profile {
                ranking
                reputation
            }
        }
    }
    """
    resp = httpx.post(
        LEETCODE_GRAPHQL,
        json={"query": query, "variables": {"username": username}},
        headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
        timeout=15,
    )
    return resp.json().get("data", {}).get("matchedUser", {})


def fetch_recent_submissions(username: str, limit: int = 20) -> list[dict]:
    query = """
    query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
            id
            title
            titleSlug
            timestamp
            lang
        }
    }
    """
    resp = httpx.post(
        LEETCODE_GRAPHQL,
        json={"query": query, "variables": {"username": username, "limit": limit}},
        headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
        timeout=15,
    )
    return resp.json().get("data", {}).get("recentAcSubmissionList", [])


def fetch_problem_details(slug: str) -> dict:
    query = """
    query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            questionId
            title
            difficulty
            topicTags { name }
        }
    }
    """
    resp = httpx.post(
        LEETCODE_GRAPHQL,
        json={"query": query, "variables": {"titleSlug": slug}},
        headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
        timeout=15,
    )
    q = resp.json().get("data", {}).get("question", {})
    return {
        "leetcode_id": int(q.get("questionId", 0)),
        "title": q.get("title", slug),
        "slug": slug,
        "difficulty": q.get("difficulty", "Medium"),
        "topics": [t["name"] for t in q.get("topicTags", [])],
    }


# ─────────────────────────────────────────
# Ebbinghaus Spaced Repetition (SM-2)
# ─────────────────────────────────────────
def calculate_retention(last_reviewed: datetime, interval_days: int) -> float:
    """Ebbinghaus forgetting curve: R = e^(-t/S)"""
    if last_reviewed is None:
        return 0.0
    now = datetime.now(timezone.utc)
    if last_reviewed.tzinfo is None:
        last_reviewed = last_reviewed.replace(tzinfo=timezone.utc)
    days_since = (now - last_reviewed).total_seconds() / 86400
    stability = max(interval_days, 1)
    retention = math.exp(-days_since / stability)
    return round(max(0.0, min(1.0, retention)), 3)


def sm2_update(ease_factor: float, interval: int, repetitions: int, quality: int) -> tuple[float, int, int]:
    """SM-2 algorithm update"""
    if quality >= 3:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease_factor)
        repetitions += 1
    else:
        repetitions = 0
        interval = 1

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease_factor = max(1.3, ease_factor)
    return ease_factor, interval, repetitions


# ─────────────────────────────────────────
# Core Sync Logic
# ─────────────────────────────────────────
def sync_user_submissions(username: str) -> dict:
    supabase = get_supabase()

    # Fetch from LeetCode
    submissions = fetch_recent_submissions(username, limit=50)
    synced = 0

    for sub in submissions:
        slug = sub.get("titleSlug", "")
        if not slug:
            continue

        # Get or create problem
        existing = supabase.table("leetcode_problems").select("id").eq("slug", slug).execute()
        if existing.data:
            problem_id = existing.data[0]["id"]
        else:
            details = fetch_problem_details(slug)
            result = supabase.table("leetcode_problems").insert(details).execute()
            problem_id = result.data[0]["id"]

        # Store submission
        ts = int(sub.get("timestamp", 0))
        submitted_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

        supabase.table("leetcode_submissions").upsert(
            {
                "problem_id": problem_id,
                "leetcode_username": username,
                "status": "Accepted",
                "language": sub.get("lang", "unknown"),
                "submitted_at": submitted_at,
            }
        ).execute()

        # Init spaced repetition if not exists
        srs_existing = (
            supabase.table("spaced_repetition_schedule")
            .select("id")
            .eq("leetcode_username", username)
            .eq("problem_id", problem_id)
            .execute()
        )
        if not srs_existing.data:
            supabase.table("spaced_repetition_schedule").insert(
                {
                    "leetcode_username": username,
                    "problem_id": problem_id,
                    "last_reviewed": submitted_at,
                    "next_review": (datetime.fromtimestamp(ts, tz=timezone.utc) + timedelta(days=1)).isoformat(),
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "repetitions": 1,
                    "predicted_retention": 1.0,
                }
            ).execute()

        synced += 1

    # Update retention predictions
    srs_records = (
        supabase.table("spaced_repetition_schedule")
        .select("id, last_reviewed, interval_days")
        .eq("leetcode_username", username)
        .execute()
    )
    for record in srs_records.data:
        if record.get("last_reviewed"):
            lr = datetime.fromisoformat(record["last_reviewed"].replace("Z", "+00:00"))
            retention = calculate_retention(lr, record.get("interval_days", 1))
            supabase.table("spaced_repetition_schedule").update(
                {"predicted_retention": retention, "updated_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", record["id"]).execute()

    return {"synced": synced, "username": username}


# ─────────────────────────────────────────
# Email: Daily Review Nudge
# ─────────────────────────────────────────
def send_daily_review_email(username: str, email: str):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    # Get problems due for review (retention < 0.7 or overdue)
    due = (
        supabase.table("spaced_repetition_schedule")
        .select("*, leetcode_problems(title, slug, difficulty, topics)")
        .eq("leetcode_username", username)
        .lte("next_review", now.isoformat())
        .order("predicted_retention", desc=False)
        .limit(10)
        .execute()
    )

    if not due.data:
        return {"message": "No reviews due"}

    problems_html = ""
    for item in due.data[:8]:
        prob = item.get("leetcode_problems", {})
        retention_pct = round(item.get("predicted_retention", 0) * 100)
        difficulty = prob.get("difficulty", "Medium")
        color = {"Easy": "#22c55e", "Medium": "#f59e0b", "Hard": "#ef4444"}.get(difficulty, "#888")
        problems_html += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
                <a href="https://leetcode.com/problems/{prob.get('slug', '')}/" style="color:#1e40af;text-decoration:none;font-weight:500;">{prob.get('title', 'Unknown')}</a>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
                <span style="background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;">{difficulty}</span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#dc2626;font-weight:600;">{retention_pct}%</td>
        </tr>"""

    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">DevOS</h1>
            <p style="color:#94a3b8;margin:8px 0 0;">Daily LeetCode Review</p>
        </div>
        <div style="padding:32px;">
            <h2 style="color:#0f172a;margin:0 0 8px;">Good morning, {username}!</h2>
            <p style="color:#64748b;margin:0 0 24px;">You have <strong>{len(due.data)} problems</strong> due for review today. Based on the Ebbinghaus forgetting curve, you're about to forget these:</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:10px 12px;text-align:left;font-size:13px;color:#64748b;">Problem</th>
                    <th style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;">Difficulty</th>
                    <th style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;">Retention</th>
                </tr></thead>
                <tbody>{problems_html}</tbody>
            </table>
            <div style="text-align:center;">
                <a href="https://devos.vercel.app/leetcode" style="background:#0f172a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Start Reviewing →</a>
            </div>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">DevOS — AI-Powered Developer Operating System</p>
        </div>
    </div>"""

    resend.Emails.send({
        "from": "DevOS <onboarding@resend.dev>",
        "to": email,
        "subject": f"🧠 {len(due.data)} problems to review today — DevOS",
        "html": html,
    })
    return {"sent": True, "problems_count": len(due.data)}


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return health_response("leetcode")


@app.post("/sync")
def sync_submissions(req: SyncRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(sync_user_submissions, req.leetcode_username)
    return {"message": "Sync started", "username": req.leetcode_username}


@app.get("/profile/{username}")
def get_profile(username: str):
    return fetch_leetcode_profile(username)


@app.get("/schedule/{username}")
def get_schedule(username: str, limit: int = 20):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    result = (
        supabase.table("spaced_repetition_schedule")
        .select("*, leetcode_problems(title, slug, difficulty, topics)")
        .eq("leetcode_username", username)
        .order("predicted_retention", desc=False)
        .limit(limit)
        .execute()
    )

    schedule = []
    for item in result.data:
        prob = item.get("leetcode_problems", {})
        schedule.append({
            "id": item["id"],
            "problem": prob,
            "retention": item.get("predicted_retention", 0),
            "next_review": item.get("next_review"),
            "interval_days": item.get("interval_days", 1),
            "repetitions": item.get("repetitions", 0),
            "overdue": item.get("next_review", "") < now.isoformat(),
        })

    return {"schedule": schedule, "total": len(schedule)}


@app.get("/heatmap/{username}")
def get_heatmap(username: str):
    supabase = get_supabase()
    result = (
        supabase.table("leetcode_submissions")
        .select("submitted_at, leetcode_problems(difficulty, topics)")
        .eq("leetcode_username", username)
        .execute()
    )

    topic_counts: dict = {}
    difficulty_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    daily_counts: dict = {}

    for sub in result.data:
        prob = sub.get("leetcode_problems", {})
        diff = prob.get("difficulty", "Medium")
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1

        for topic in prob.get("topics", []):
            topic_counts[topic] = topic_counts.get(topic, 0) + 1

        date_str = sub["submitted_at"][:10]
        daily_counts[date_str] = daily_counts.get(date_str, 0) + 1

    top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:15]

    return {
        "difficulty_breakdown": difficulty_counts,
        "top_topics": [{"topic": t, "count": c} for t, c in top_topics],
        "daily_activity": [{"date": d, "count": c} for d, c in sorted(daily_counts.items())[-90:]],
        "total": sum(difficulty_counts.values()),
    }


@app.post("/review/update")
def update_review(req: UpdateReviewRequest):
    supabase = get_supabase()
    record = (
        supabase.table("spaced_repetition_schedule")
        .select("*")
        .eq("id", req.problem_id)
        .single()
        .execute()
    )
    if not record.data:
        raise HTTPException(status_code=404, detail="Schedule record not found")

    r = record.data
    new_ef, new_interval, new_reps = sm2_update(
        r["ease_factor"], r["interval_days"], r["repetitions"], req.performance
    )
    now = datetime.now(timezone.utc)
    next_review = (now + timedelta(days=new_interval)).isoformat()

    supabase.table("spaced_repetition_schedule").update({
        "ease_factor": new_ef,
        "interval_days": new_interval,
        "repetitions": new_reps,
        "last_reviewed": now.isoformat(),
        "next_review": next_review,
        "predicted_retention": 1.0,
        "updated_at": now.isoformat(),
    }).eq("id", req.problem_id).execute()

    return {"success": True, "next_review": next_review, "new_interval": new_interval}


@app.post("/send-review-email")
def trigger_email(req: EmailRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(send_daily_review_email, req.username, req.email)
    return {"message": "Email queued"}


@app.get("/weak-patterns/{username}")
def get_weak_patterns(username: str):
    supabase = get_supabase()
    result = (
        supabase.table("spaced_repetition_schedule")
        .select("predicted_retention, leetcode_problems(difficulty, topics)")
        .eq("leetcode_username", username)
        .execute()
    )

    topic_retention: dict = {}
    for item in result.data:
        prob = item.get("leetcode_problems", {})
        retention = item.get("predicted_retention", 1.0)
        for topic in prob.get("topics", []):
            if topic not in topic_retention:
                topic_retention[topic] = []
            topic_retention[topic].append(retention)

    weak_patterns = []
    for topic, retentions in topic_retention.items():
        avg_retention = sum(retentions) / len(retentions)
        weak_patterns.append({
            "topic": topic,
            "avg_retention": round(avg_retention, 3),
            "problem_count": len(retentions),
            "needs_review": avg_retention < 0.6,
        })

    weak_patterns.sort(key=lambda x: x["avg_retention"])
    return {"weak_patterns": weak_patterns[:15]}

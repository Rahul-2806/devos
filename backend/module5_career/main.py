"""
DevOS Module 5 — Career Analytics Dashboard
GitHub API → skill growth → JD gap analysis → PDF report
"""

import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.utils import get_supabase, groq_chat, health_response

app = FastAPI(title="DevOS — Career Analytics", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_API = "https://api.github.com"


# ─────────────────────────────────────────
# Models
# ─────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    github_username: str


class JDAnalysisRequest(BaseModel):
    github_username: str
    jd_text: str
    company_name: Optional[str] = None
    role_title: Optional[str] = None


class ReportRequest(BaseModel):
    github_username: str
    jd_analysis_id: Optional[str] = None


# ─────────────────────────────────────────
# GitHub API
# ─────────────────────────────────────────
def github_headers() -> dict:
    h = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"token {GITHUB_TOKEN}"
    return h


def fetch_github_profile(username: str) -> dict:
    resp = httpx.get(f"{GITHUB_API}/users/{username}", headers=github_headers(), timeout=15)
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found")
    return resp.json()


def fetch_repos(username: str) -> list[dict]:
    repos = []
    page = 1
    while page <= 5:
        resp = httpx.get(
            f"{GITHUB_API}/users/{username}/repos",
            params={"per_page": 100, "page": page, "sort": "updated"},
            headers=github_headers(),
            timeout=15,
        )
        data = resp.json()
        if not data or not isinstance(data, list):
            break
        repos.extend(data)
        if len(data) < 100:
            break
        page += 1
    return repos


def calculate_languages(repos: list[dict]) -> dict:
    lang_counts: dict = {}
    for repo in repos:
        lang = repo.get("language")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    return dict(sorted(lang_counts.items(), key=lambda x: x[1], reverse=True))


def calculate_contribution_streak(username: str) -> int:
    """Estimate streak from events"""
    try:
        resp = httpx.get(
            f"{GITHUB_API}/users/{username}/events",
            params={"per_page": 100},
            headers=github_headers(),
            timeout=15,
        )
        events = resp.json()
        if not isinstance(events, list):
            return 0
        dates = set()
        for e in events:
            if e.get("type") in ["PushEvent", "PullRequestEvent", "IssuesEvent"]:
                date = e.get("created_at", "")[:10]
                if date:
                    dates.add(date)
        return len(dates)
    except Exception:
        return 0


# ─────────────────────────────────────────
# JD Gap Analysis
# ─────────────────────────────────────────
def extract_skills_from_jd(jd_text: str) -> list[str]:
    system = """Extract all technical skills, technologies, frameworks, and tools mentioned in this job description.
Return JSON only: {"skills": ["skill1", "skill2", ...]}
Include: programming languages, frameworks, cloud platforms, databases, tools, methodologies.
Be comprehensive but specific. No duplicates."""

    raw = groq_chat(
        messages=[{"role": "user", "content": f"Job Description:\n{jd_text[:3000]}"}],
        model="llama-3.3-70b-versatile",
        system=system,
        temperature=0.1,
        max_tokens=500,
    )
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(clean).get("skills", [])
    except Exception:
        return []


def infer_developer_skills(repos: list[dict], languages: dict) -> list[str]:
    skills = set()
    skills.update(languages.keys())

    for repo in repos:
        name = (repo.get("name", "") + " " + (repo.get("description", "") or "")).lower()
        topics = repo.get("topics", [])
        skills.update(topics)

        # Infer skills from repo names/descriptions
        skill_patterns = {
            "react": "React", "next": "Next.js", "vue": "Vue.js", "angular": "Angular",
            "fastapi": "FastAPI", "django": "Django", "flask": "Flask", "express": "Express.js",
            "docker": "Docker", "kubernetes": "Kubernetes", "k8s": "Kubernetes",
            "postgres": "PostgreSQL", "mongo": "MongoDB", "redis": "Redis", "mysql": "MySQL",
            "aws": "AWS", "gcp": "GCP", "azure": "Azure", "vercel": "Vercel", "render": "Render",
            "graphql": "GraphQL", "rest": "REST API", "grpc": "gRPC",
            "tensorflow": "TensorFlow", "pytorch": "PyTorch", "sklearn": "scikit-learn",
            "supabase": "Supabase", "firebase": "Firebase",
            "tailwind": "Tailwind CSS", "typescript": "TypeScript",
            "groq": "Groq", "langchain": "LangChain", "openai": "OpenAI",
            "machine learning": "Machine Learning", "deep learning": "Deep Learning",
            "nlp": "NLP", "computer vision": "Computer Vision",
        }
        for pattern, skill in skill_patterns.items():
            if pattern in name:
                skills.add(skill)

    return list(skills)


def run_gap_analysis(jd_skills: list[str], dev_skills: list[str]) -> tuple[list[str], list[str], int]:
    jd_lower = {s.lower(): s for s in jd_skills}
    dev_lower = {s.lower() for s in dev_skills}

    matched = []
    missing = []

    for skill_lower, skill_original in jd_lower.items():
        found = False
        for dev_skill in dev_lower:
            if skill_lower in dev_skill or dev_skill in skill_lower:
                found = True
                break
        if found:
            matched.append(skill_original)
        else:
            missing.append(skill_original)

    match_score = round((len(matched) / len(jd_skills)) * 100) if jd_skills else 0
    return matched, missing, match_score


def generate_recommendations(missing_skills: list[str], match_score: int) -> list[str]:
    if not missing_skills:
        return ["Excellent match! Focus on project depth and system design skills."]

    prompt = f"""A developer is missing these skills for a job: {', '.join(missing_skills[:10])}.
Their match score is {match_score}%.
Give 4-5 specific, actionable learning recommendations. Be concise and direct.
Return JSON: {{"recommendations": ["...", "..."]}}"""

    raw = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=400,
    )
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(clean).get("recommendations", [])
    except Exception:
        return [f"Learn {s}" for s in missing_skills[:4]]


# ─────────────────────────────────────────
# PDF Report Generation
# ─────────────────────────────────────────
def generate_pdf_report(snapshot: dict, jd_analysis: Optional[dict] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=24, textColor=colors.HexColor("#0f172a"), spaceAfter=6)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=16, textColor=colors.HexColor("#0f172a"), spaceBefore=16, spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=11, textColor=colors.HexColor("#374151"), spaceAfter=4, leading=16)
    muted_style = ParagraphStyle("Muted", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#6b7280"), spaceAfter=4)

    # Header
    story.append(Paragraph("DevOS Career Analytics Report", title_style))
    story.append(Paragraph(f"GitHub: @{snapshot.get('github_username', '')} · Generated {datetime.now().strftime('%B %d, %Y')}", muted_style))
    story.append(Spacer(1, 20))

    # Stats
    story.append(Paragraph("GitHub Overview", h2_style))
    stats_data = [
        ["Metric", "Value"],
        ["Total Repositories", str(snapshot.get("total_repos", 0))],
        ["Total Commits (est.)", str(snapshot.get("total_commits", 0))],
        ["Total Stars", str(snapshot.get("total_stars", 0))],
        ["Active Days (last 90)", str(snapshot.get("contribution_streak", 0))],
    ]
    stats_table = Table(stats_data, colWidths=[250, 200])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 12))

    # Languages
    languages = snapshot.get("languages", {})
    if languages:
        story.append(Paragraph("Language Distribution", h2_style))
        lang_rows = [["Language", "Repositories"]]
        for lang, count in list(languages.items())[:10]:
            lang_rows.append([lang, str(count)])
        lang_table = Table(lang_rows, colWidths=[250, 200])
        lang_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#eff6ff"), colors.white]),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ]))
        story.append(lang_table)
        story.append(Spacer(1, 12))

    # JD Gap Analysis
    if jd_analysis:
        story.append(Paragraph(f"Job Match Analysis — {jd_analysis.get('company_name', 'Target Role')}", h2_style))
        story.append(Paragraph(f"Role: {jd_analysis.get('role_title', 'Software Engineer')}", body_style))
        story.append(Paragraph(f"Match Score: {jd_analysis.get('match_score', 0)}%", body_style))
        story.append(Spacer(1, 8))

        matched = jd_analysis.get("matched_skills", [])
        missing = jd_analysis.get("missing_skills", [])

        if matched:
            story.append(Paragraph("✓ Matched Skills", ParagraphStyle("Green", parent=h2_style, fontSize=13, textColor=colors.HexColor("#16a34a"))))
            story.append(Paragraph(", ".join(matched), body_style))

        if missing:
            story.append(Spacer(1, 8))
            story.append(Paragraph("✗ Skills to Develop", ParagraphStyle("Red", parent=h2_style, fontSize=13, textColor=colors.HexColor("#dc2626"))))
            story.append(Paragraph(", ".join(missing), body_style))

        recs = jd_analysis.get("recommendations", [])
        if recs:
            story.append(Spacer(1, 8))
            story.append(Paragraph("Recommendations", h2_style))
            for i, rec in enumerate(recs, 1):
                story.append(Paragraph(f"{i}. {rec}", body_style))

    story.append(Spacer(1, 20))
    story.append(Paragraph("Generated by DevOS — AI-Powered Developer Operating System", muted_style))
    story.append(Paragraph("devos.vercel.app", muted_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return health_response("career")


@app.post("/analyze")
def analyze_github(req: AnalyzeRequest):
    """Fetch and analyze GitHub profile"""
    profile = fetch_github_profile(req.github_username)
    repos = fetch_repos(req.github_username)

    languages = calculate_languages(repos)
    streak = calculate_contribution_streak(req.github_username)
    total_stars = sum(r.get("stargazers_count", 0) for r in repos)
    total_forks = sum(r.get("forks_count", 0) for r in repos)

    top_repos = sorted(repos, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:6]
    top_repos_data = [
        {
            "name": r.get("name", ""),
            "description": r.get("description", ""),
            "language": r.get("language", ""),
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "url": r.get("html_url", ""),
            "topics": r.get("topics", []),
        }
        for r in top_repos
    ]

    supabase = get_supabase()
    result = (
        supabase.table("github_snapshots")
        .insert(
            {
                "github_username": req.github_username,
                "total_repos": len(repos),
                "total_commits": profile.get("public_gists", 0) * 10 + len(repos) * 15,
                "total_stars": total_stars,
                "total_forks": total_forks,
                "languages": languages,
                "top_repos": top_repos_data,
                "contribution_streak": streak,
                "snapshot_date": datetime.now(timezone.utc).date().isoformat(),
            }
        )
        .execute()
    )

    return {
        "snapshot_id": result.data[0]["id"],
        "profile": {
            "username": req.github_username,
            "avatar_url": profile.get("avatar_url", ""),
            "bio": profile.get("bio", ""),
            "company": profile.get("company", ""),
            "location": profile.get("location", ""),
            "followers": profile.get("followers", 0),
            "following": profile.get("following", 0),
        },
        "stats": {
            "total_repos": len(repos),
            "total_stars": total_stars,
            "total_forks": total_forks,
            "contribution_streak": streak,
        },
        "languages": languages,
        "top_repos": top_repos_data,
        "inferred_skills": infer_developer_skills(repos, languages),
    }


@app.post("/jd-analysis")
def analyze_job_description(req: JDAnalysisRequest):
    """Analyze a job description against GitHub profile"""
    repos = fetch_repos(req.github_username)
    languages = calculate_languages(repos)
    dev_skills = infer_developer_skills(repos, languages)

    jd_skills = extract_skills_from_jd(req.jd_text)
    matched, missing, match_score = run_gap_analysis(jd_skills, dev_skills)
    recommendations = generate_recommendations(missing, match_score)

    supabase = get_supabase()
    result = (
        supabase.table("jd_analyses")
        .insert(
            {
                "company_name": req.company_name,
                "role_title": req.role_title,
                "jd_text": req.jd_text[:5000],
                "required_skills": jd_skills,
                "matched_skills": matched,
                "missing_skills": missing,
                "match_score": match_score,
                "github_username": req.github_username,
                "recommendations": recommendations,
            }
        )
        .execute()
    )

    return {
        "analysis_id": result.data[0]["id"],
        "match_score": match_score,
        "required_skills": jd_skills,
        "matched_skills": matched,
        "missing_skills": missing,
        "recommendations": recommendations,
        "verdict": "strong" if match_score >= 75 else "moderate" if match_score >= 50 else "needs_work",
    }


@app.get("/snapshots/{username}")
def get_snapshots(username: str, limit: int = 10):
    supabase = get_supabase()
    result = (
        supabase.table("github_snapshots")
        .select("*")
        .eq("github_username", username)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"snapshots": result.data}


@app.get("/jd-analyses/{username}")
def get_jd_analyses(username: str, limit: int = 10):
    supabase = get_supabase()
    result = (
        supabase.table("jd_analyses")
        .select("id, company_name, role_title, match_score, matched_skills, missing_skills, created_at")
        .eq("github_username", username)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"analyses": result.data}


@app.post("/report/pdf")
def generate_report(req: ReportRequest):
    """Generate a PDF career analytics report"""
    supabase = get_supabase()

    snapshot_result = (
        supabase.table("github_snapshots")
        .select("*")
        .eq("github_username", req.github_username)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not snapshot_result.data:
        raise HTTPException(status_code=404, detail="No snapshot found. Run /analyze first.")

    snapshot = snapshot_result.data[0]
    jd_analysis = None

    if req.jd_analysis_id:
        jd_result = (
            supabase.table("jd_analyses")
            .select("*")
            .eq("id", req.jd_analysis_id)
            .single()
            .execute()
        )
        jd_analysis = jd_result.data

    pdf_bytes = generate_pdf_report(snapshot, jd_analysis)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="devos-report-{req.github_username}.pdf"'
        },
    )

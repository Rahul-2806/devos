# DevOS v2 — AI-Powered Developer Operating System

> A unified intelligent platform that makes developers measurably better — combining AI code review, a personal knowledge graph, ML-driven DSA preparation, vision-based system design analysis, career analytics, and an autonomous PR review agent in one cohesive system.

**Live Demo:** [devos-2806.vercel.app](https://devos-2806.vercel.app) &nbsp;|&nbsp; **Backend:** Hugging Face Spaces (6 microservices)

---

## What is DevOS?

DevOS is a full-stack AI platform built for software engineers who want to accelerate their growth. It solves 6 real problems developers face every day:

| Module | Problem Solved |
|--------|---------------|
| AI Code Review Engine | "My PRs get reviewed days later with vague feedback" |
| Knowledge Graph (RAG) | "I read great articles but forget everything in a week" |
| LeetCode Intelligence Tracker | "I practice randomly with no strategy" |
| System Design Vision Chat | "I can't get expert feedback on my architecture diagrams" |
| Career Analytics Dashboard | "I don't know my exact skill gaps vs job requirements" |
| **Autonomous PR Review Agent** | **"I want AI to review every PR automatically without being asked"** |

---

## Tech Stack

**Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Framer Motion · Recharts · D3.js

**Backend:** FastAPI (Python 3.11) · 6 microservices · Docker · Uvicorn

**AI:** Groq LLaMA 3.3 70B · LLaMA 4 Scout Vision · Sentence Transformers · **LangGraph**

**Database:** Supabase (PostgreSQL + pgvector) · Supabase Storage

**Infra:** Hugging Face Spaces (all backends) · Vercel (frontend) · Docker

**Integrations:** GitHub Webhooks · GitHub API · Resend (email)

---

## Architecture

```
devos/
├── frontend/                     # Next.js 15 — unified app, 6 module routes
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── dashboard/            # Unified dashboard
│   │   ├── code-review/          # Module 1
│   │   ├── knowledge/            # Module 2
│   │   ├── leetcode/             # Module 3
│   │   ├── design-chat/          # Module 4
│   │   ├── career/               # Module 5
│   │   └── agent/                # Module 6 — PR Review Agent
│   └── components/
├── hf_module1_code_review/       # HF Space — GitHub webhook → LLM review
├── hf_module2_knowledge/         # HF Space — RAG ingestion + semantic search
├── hf_module3_leetcode/          # HF Space — SM-2 spaced repetition + email
├── hf_module4_vision/            # HF Space — Vision API + design chat
├── hf_module5_career/            # HF Space — GitHub API + gap analysis + PDF
└── hf_module6_agent/             # HF Space — LangGraph autonomous PR agent
```

---

## Module 1 — AI Code Review Engine

Connects to your GitHub via webhooks. Every PR you push gets automatically reviewed by LLaMA 3.3 70B, which returns:
- Security vulnerability scan
- Code complexity score
- Improvement suggestions with examples
- Review stored in Supabase with pgvector for semantic search across past reviews

## Module 2 — Personal Knowledge Graph

Paste any article URL, text, or code snippet. The system:
- Chunks and embeds it using sentence transformers
- Stores vectors in pgvector
- Lets you semantically search your entire personal knowledge base
- "What do I know about database indexing?" → surfaces your saved notes, not Google

## Module 3 — LeetCode Intelligence Tracker

Connects to your LeetCode profile and:
- Pulls all your submission history
- Trains an Ebbinghaus forgetting curve model per topic
- Predicts which problems you're about to forget
- Sends daily email nudges with exactly the problems to review
- Shows a live skill heatmap and weak-pattern radar

## Module 4 — System Design Vision Chat

Upload any architecture diagram (photo, screenshot, whiteboard). LLaMA 4 Scout Vision:
- Identifies all components and their relationships
- Flags single points of failure, bottlenecks, missing load balancers
- You can chat: "How do I scale this to 10M users?"
- Saves your design library for future reference

## Module 5 — Career Analytics Dashboard

Connects to your GitHub and analyzes:
- Contribution velocity over time
- Language and technology distribution
- Commit pattern and consistency score
- Paste any job description → gap analysis → skill recommendations
- One-click PDF report generation

## Module 6 — Autonomous PR Review Agent ⚡ New in v2

A LangGraph multi-agent pipeline that **autonomously watches your GitHub repos** and reviews every PR without being asked.

**How it works:**
1. GitHub webhook fires on every PR opened or updated
2. 3 specialized AI agents run in parallel on the diff:
   - 🔐 **Security Agent** — SQL injection, hardcoded secrets, auth flaws
   - ⚡ **Performance Agent** — O(n²) complexity, N+1 queries, missing async
   - 📖 **Readability Agent** — naming, SRP violations, missing docs
3. Agents converge → weighted risk score (0–100)
4. Unified verdict posted automatically as a GitHub PR comment
5. Review saved to Supabase for dashboard analytics

**Risk scoring:**
- 🟢 0–39 → APPROVE
- 🟡 40–69 → REVIEW
- 🔴 70–100 → BLOCK

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- Groq API key (free at console.groq.com)
- GitHub Personal Access Token (repo scope)

### 1. Clone & install

```bash
git clone https://github.com/Rahul-2806/devos
cd devos
```

### 2. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in your keys
npm run dev
```

### 3. Run any backend module locally

```bash
cd hf_module6_agent
pip install -r requirements.txt
uvicorn main:app --reload --port 8006
```

---

## Environment Variables

```env
# Groq
GROQ_API_KEY=your_key

# Supabase
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_key

# GitHub (for Module 1 + Module 6 webhooks)
GITHUB_WEBHOOK_SECRET=your_secret
GITHUB_TOKEN=your_personal_access_token

# Resend (for Module 3 emails)
RESEND_API_KEY=your_key
```

---

## Supabase Schema (Module 6)

```sql
create table pr_reviews (
  id                  bigserial primary key,
  repo                text not null,
  pr_number           integer not null,
  pr_title            text,
  risk_score          integer default 0,
  verdict             text,
  security_issues     jsonb default '[]',
  performance_issues  jsonb default '[]',
  readability_issues  jsonb default '[]',
  security_severity   text default 'LOW',
  perf_severity       text default 'LOW',
  read_severity       text default 'LOW',
  reviewed_at         timestamptz default now()
);
```

---

## Deployment

All backends deploy as Docker containers on **Hugging Face Spaces** (free, no sleep).

Each module:
1. Has its own `Dockerfile` exposing port `7860`
2. Reads secrets from HF Space environment variables
3. Is completely independent — deploy or update any module without touching others

Frontend deploys on **Vercel** with auto-deploy on every push to `main`.

---

## Built by

**Rahul** — Full Stack Developer & Data Scientist  
[rahulaiportfolio.online](https://rahulaiportfolio.online) · [GitHub](https://github.com/Rahul-2806) · Kollam, Kerala, India
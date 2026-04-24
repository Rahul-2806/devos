# DevOS — AI-Powered Developer Operating System

> A unified intelligent platform that makes developers measurably better — combining AI code review, a personal knowledge graph, ML-driven DSA preparation, vision-based system design analysis, and career analytics in one cohesive system.

**Live Demo:** [devos.vercel.app](https://devos.vercel.app) &nbsp;|&nbsp; **Backend:** [devos-api.onrender.com](https://devos-api.onrender.com)

---

## What is DevOS?

DevOS is a full-stack AI platform built for software engineers who want to accelerate their growth. It solves 5 real problems developers face every day:

| Module | Problem Solved |
|--------|---------------|
| AI Code Review Engine | "My PRs get reviewed days later with vague feedback" |
| Knowledge Graph (RAG) | "I read great articles but forget everything in a week" |
| LeetCode Intelligence Tracker | "I practice randomly with no strategy" |
| System Design Vision Chat | "I can't get expert feedback on my architecture diagrams" |
| Career Analytics Dashboard | "I don't know my exact skill gaps vs FAANG requirements" |

---

## Tech Stack

**Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Framer Motion · Recharts · D3.js

**Backend:** FastAPI (Python 3.11) · 5 microservices · Docker · Uvicorn

**AI:** Groq LLaMA 3.1 70B · LLaMA 3.2 Vision · Sentence Transformers

**Database:** Supabase (PostgreSQL + pgvector) · Supabase Storage · Supabase Auth

**Infra:** Render (backend) · Vercel (frontend) · Docker Compose · cron-job.org

**Notifications:** Resend (email) · GitHub Webhooks

---

## Architecture

```
devos/
├── frontend/          # Next.js 15 — unified app, 5 module routes
│   ├── app/
│   │   ├── page.tsx              # Cinematic landing page
│   │   ├── dashboard/            # Unified dashboard
│   │   ├── code-review/          # Module 1
│   │   ├── knowledge/            # Module 2
│   │   ├── leetcode/             # Module 3
│   │   ├── design-chat/          # Module 4
│   │   └── career/               # Module 5
│   └── components/
├── backend/
│   ├── shared/                   # Supabase client, Groq client, auth middleware
│   ├── module1_code_review/      # GitHub webhook → LLM review pipeline
│   ├── module2_knowledge/        # RAG ingestion + semantic search
│   ├── module3_leetcode/         # Scraper + ML spaced repetition
│   ├── module4_vision/           # Vision API + design chat
│   └── module5_career/           # GitHub API + gap analysis + PDF
└── docker-compose.yml
```

---

## Module 1 — AI Code Review Engine

Connects to your GitHub via webhooks. Every PR you push gets automatically reviewed by LLaMA 3.1 70B, which returns:
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

Upload any architecture diagram (photo, screenshot, whiteboard). LLaMA 3.2 Vision:
- Identifies all components and their relationships
- Flags single points of failure, bottlenecks, missing load balancers
- You can chat: "How do I scale this to 10M users?"
- Saves your design library for future reference

## Module 5 — Career Analytics Dashboard

Connects to your GitHub and analyzes:
- Contribution velocity over time
- Language and technology distribution
- Commit pattern and consistency score
- Paste any job description → gap analysis → "you're missing: Kubernetes, Go, system design"
- One-click PDF report generation

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop
- Supabase account
- Groq API key (free at console.groq.com)

### 1. Clone & install

```bash
git clone https://github.com/Rahul-2806/devos
cd devos
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill in your keys in .env
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in your keys
npm run dev
```

### 4. Docker (all services at once)

```bash
docker-compose up --build
```

---

## Environment Variables

```env
# Groq
GROQ_API_KEY=your_key

# Supabase
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_key

# GitHub (for Module 1 webhook)
GITHUB_WEBHOOK_SECRET=your_secret

# Resend (for Module 3 emails)
RESEND_API_KEY=your_key

# GitHub Token (for Module 5)
GITHUB_TOKEN=your_personal_access_token
```

---

## Deployment

**Backend (Render):** Each module deploys as a separate web service. Set `PYTHON_VERSION=3.11.8`, start command: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend (Vercel):** Connect GitHub repo, set environment variables, deploy.

**Keep-alive:** Add all Render `/health` endpoints to cron-job.org (every 14 minutes).

---

## Built by

**Rahul** — Full Stack Developer & Data Scientist  
[rahulaiportfolio.online](https://rahulaiportfolio.online) · [GitHub](https://github.com/Rahul-2806) · Kollam, Kerala, India

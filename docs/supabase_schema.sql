-- DevOS — Full Supabase Schema
-- Run this entire file in your Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- MODULE 1: AI Code Review Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS code_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repo_name TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    pr_title TEXT,
    pr_url TEXT,
    author TEXT,
    diff_summary TEXT,
    security_score INTEGER CHECK (security_score BETWEEN 0 AND 100),
    quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    complexity_score INTEGER CHECK (complexity_score BETWEEN 0 AND 100),
    issues JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    full_review TEXT,
    review_embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS code_reviews_embedding_idx 
    ON code_reviews USING ivfflat (review_embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS code_reviews_repo_idx ON code_reviews (repo_name);
CREATE INDEX IF NOT EXISTS code_reviews_created_idx ON code_reviews (created_at DESC);

-- ============================================================
-- MODULE 2: Knowledge Graph (RAG)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    source_type TEXT CHECK (source_type IN ('article', 'code', 'note', 'video', 'paper')),
    tags TEXT[] DEFAULT '{}',
    embedding vector(384),
    chunk_index INTEGER DEFAULT 0,
    parent_id UUID REFERENCES knowledge_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_embedding_idx 
    ON knowledge_items USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS knowledge_tags_idx ON knowledge_items USING gin (tags);
CREATE INDEX IF NOT EXISTS knowledge_source_type_idx ON knowledge_items (source_type);

-- ============================================================
-- MODULE 3: LeetCode Intelligence Tracker
-- ============================================================

CREATE TABLE IF NOT EXISTS leetcode_problems (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    leetcode_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leetcode_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    problem_id UUID REFERENCES leetcode_problems(id),
    leetcode_username TEXT NOT NULL,
    status TEXT NOT NULL,
    language TEXT,
    runtime_ms INTEGER,
    memory_mb FLOAT,
    submitted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spaced_repetition_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    leetcode_username TEXT NOT NULL,
    problem_id UUID REFERENCES leetcode_problems(id),
    last_reviewed TIMESTAMPTZ,
    next_review TIMESTAMPTZ,
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    predicted_retention FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS srs_username_idx ON spaced_repetition_schedule (leetcode_username);
CREATE INDEX IF NOT EXISTS srs_next_review_idx ON spaced_repetition_schedule (next_review ASC);
CREATE INDEX IF NOT EXISTS submissions_username_idx ON leetcode_submissions (leetcode_username);

-- ============================================================
-- MODULE 4: System Design Vision Chat
-- ============================================================

CREATE TABLE IF NOT EXISTS design_diagrams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    image_path TEXT,
    components_detected JSONB DEFAULT '[]',
    bottlenecks JSONB DEFAULT '[]',
    spof_list JSONB DEFAULT '[]',
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagram_id UUID REFERENCES design_diagrams(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS design_diagrams_created_idx ON design_diagrams (created_at DESC);
CREATE INDEX IF NOT EXISTS design_chat_diagram_idx ON design_chat_messages (diagram_id);

-- ============================================================
-- MODULE 5: Career Analytics Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS github_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    github_username TEXT NOT NULL,
    total_repos INTEGER DEFAULT 0,
    total_commits INTEGER DEFAULT 0,
    total_stars INTEGER DEFAULT 0,
    total_forks INTEGER DEFAULT 0,
    languages JSONB DEFAULT '{}',
    top_repos JSONB DEFAULT '[]',
    contribution_streak INTEGER DEFAULT 0,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jd_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT,
    role_title TEXT,
    jd_text TEXT NOT NULL,
    required_skills JSONB DEFAULT '[]',
    matched_skills JSONB DEFAULT '[]',
    missing_skills JSONB DEFAULT '[]',
    match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
    github_username TEXT,
    recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS github_snapshots_username_idx ON github_snapshots (github_username);
CREATE INDEX IF NOT EXISTS jd_analyses_created_idx ON jd_analyses (created_at DESC);

-- ============================================================
-- HELPER FUNCTION: Semantic search for Module 2
-- ============================================================

CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector(384),
    similarity_threshold FLOAT DEFAULT 0.5,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    source_url TEXT,
    source_type TEXT,
    tags TEXT[],
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.title,
        k.content,
        k.source_url,
        k.source_type,
        k.tags,
        1 - (k.embedding <=> query_embedding) AS similarity,
        k.created_at
    FROM knowledge_items k
    WHERE k.embedding IS NOT NULL
      AND 1 - (k.embedding <=> query_embedding) > similarity_threshold
    ORDER BY k.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Helper function for similar code reviews
CREATE OR REPLACE FUNCTION search_similar_reviews(
    query_embedding vector(384),
    max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    repo_name TEXT,
    pr_title TEXT,
    full_review TEXT,
    security_score INTEGER,
    quality_score INTEGER,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id,
        cr.repo_name,
        cr.pr_title,
        cr.full_review,
        cr.security_score,
        cr.quality_score,
        1 - (cr.review_embedding <=> query_embedding) AS similarity,
        cr.created_at
    FROM code_reviews cr
    WHERE cr.review_embedding IS NOT NULL
    ORDER BY cr.review_embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- Create bucket: design-diagrams (public: false)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('design-diagrams', 'design-diagrams', false);

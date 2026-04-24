"""
DevOS Module 2 — Personal Knowledge Graph (RAG)
Ingest any content → embed → semantic search your own knowledge base
"""

import os
import sys
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.utils import get_supabase, groq_chat, embed_text, embed_texts, health_response

app = FastAPI(title="DevOS — Knowledge Graph", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────
# Models
# ─────────────────────────────────────────
class IngestRequest(BaseModel):
    content: str
    title: Optional[str] = None
    source_url: Optional[str] = None
    source_type: str = "note"  # article|code|note|video|paper
    tags: list[str] = []


class URLIngestRequest(BaseModel):
    url: str
    tags: list[str] = []


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    source_type: Optional[str] = None
    similarity_threshold: float = 0.3


class AskRequest(BaseModel):
    question: str
    limit: int = 5


# ─────────────────────────────────────────
# Content Processing
# ─────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks for better retrieval"""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


def extract_from_url(url: str) -> tuple[str, str]:
    """Fetch and extract clean text from a URL"""
    resp = httpx.get(url, timeout=15, follow_redirects=True)
    soup = BeautifulSoup(resp.text, "lxml")

    # Remove junk
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    title = soup.title.string if soup.title else url
    content = soup.get_text(separator=" ", strip=True)
    return title.strip(), content[:15000]


def generate_title_and_tags(content: str, existing_title: Optional[str]) -> tuple[str, list[str]]:
    prompt = f"""Given this content, extract a concise title (if not provided) and 3-5 relevant tags.
Content (first 500 chars): {content[:500]}
Existing title: {existing_title or 'None'}

Return JSON only:
{{"title": "...", "tags": ["tag1", "tag2", "tag3"]}}"""

    import json, re
    raw = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        temperature=0.2,
        max_tokens=200,
    )
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        data = json.loads(clean)
        return data.get("title", existing_title or "Untitled"), data.get("tags", [])
    except Exception:
        return existing_title or "Untitled", []


def store_knowledge_item(
    title: str,
    content: str,
    source_url: Optional[str],
    source_type: str,
    tags: list[str],
) -> list[str]:
    supabase = get_supabase()
    chunks = chunk_text(content)
    embeddings = embed_texts(chunks)

    ids = []
    parent_id = None

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        result = (
            supabase.table("knowledge_items")
            .insert(
                {
                    "title": title if i == 0 else f"{title} (part {i+1})",
                    "content": chunk,
                    "source_url": source_url,
                    "source_type": source_type,
                    "tags": tags,
                    "embedding": embedding,
                    "chunk_index": i,
                    "parent_id": parent_id,
                }
            )
            .execute()
        )
        item_id = result.data[0]["id"]
        if i == 0:
            parent_id = item_id
        ids.append(item_id)

    return ids


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return health_response("knowledge")


@app.post("/ingest")
def ingest_content(req: IngestRequest):
    """Ingest raw text/code/note into knowledge graph"""
    title = req.title
    tags = req.tags

    if not title or not tags:
        auto_title, auto_tags = generate_title_and_tags(req.content, req.title)
        title = title or auto_title
        tags = tags or auto_tags

    ids = store_knowledge_item(title, req.content, req.source_url, req.source_type, tags)
    return {"success": True, "chunks_stored": len(ids), "title": title, "tags": tags}


@app.post("/ingest/url")
def ingest_url(req: URLIngestRequest):
    """Fetch a URL and ingest its content"""
    try:
        title, content = extract_from_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {str(e)}")

    _, auto_tags = generate_title_and_tags(content, title)
    tags = req.tags or auto_tags

    ids = store_knowledge_item(title, content, req.url, "article", tags)
    return {"success": True, "chunks_stored": len(ids), "title": title, "tags": tags}


@app.post("/search")
def semantic_search(req: SearchRequest):
    """Semantic search across knowledge base"""
    supabase = get_supabase()
    query_embedding = embed_text(req.query)

    result = supabase.rpc(
        "search_knowledge",
        {
            "query_embedding": query_embedding,
            "similarity_threshold": req.similarity_threshold,
            "max_results": req.limit,
        },
    ).execute()

    results = result.data or []
    if req.source_type:
        results = [r for r in results if r.get("source_type") == req.source_type]

    return {"results": results, "total": len(results), "query": req.query}


@app.post("/ask")
def ask_knowledge_base(req: AskRequest):
    """RAG: search knowledge base then answer with Groq"""
    supabase = get_supabase()
    query_embedding = embed_text(req.question)

    result = supabase.rpc(
        "search_knowledge",
        {
            "query_embedding": query_embedding,
            "similarity_threshold": 0.25,
            "max_results": req.limit,
        },
    ).execute()

    context_items = result.data or []
    if not context_items:
        return {
            "answer": "I don't have any relevant knowledge about this topic yet. Try adding some articles or notes first!",
            "sources": [],
        }

    context = "\n\n---\n\n".join(
        [f"Source: {item['title']}\n{item['content']}" for item in context_items]
    )

    system = """You are a personal knowledge assistant. Answer questions using ONLY the provided context from the user's personal knowledge base. 
Be specific and cite which sources you're drawing from. If the context doesn't fully answer the question, say so."""

    prompt = f"""Context from my knowledge base:
{context}

Question: {req.question}"""

    answer = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        system=system,
        temperature=0.2,
        max_tokens=1024,
    )

    sources = [
        {
            "title": item["title"],
            "source_url": item.get("source_url"),
            "similarity": round(item["similarity"], 3),
            "tags": item.get("tags", []),
        }
        for item in context_items
    ]

    return {"answer": answer, "sources": sources}


@app.get("/items")
def list_items(limit: int = 20, offset: int = 0, source_type: Optional[str] = None, tag: Optional[str] = None):
    supabase = get_supabase()
    query = (
        supabase.table("knowledge_items")
        .select("id, title, source_url, source_type, tags, chunk_index, created_at")
        .eq("chunk_index", 0)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if source_type:
        query = query.eq("source_type", source_type)
    result = query.execute()
    return {"items": result.data, "total": len(result.data)}


@app.delete("/items/{item_id}")
def delete_item(item_id: str):
    supabase = get_supabase()
    supabase.table("knowledge_items").delete().or_(
        f"id.eq.{item_id},parent_id.eq.{item_id}"
    ).execute()
    return {"success": True}


@app.get("/stats")
def get_stats():
    supabase = get_supabase()
    items = supabase.table("knowledge_items").select("source_type, tags").eq("chunk_index", 0).execute()
    data = items.data or []

    type_counts: dict = {}
    all_tags: dict = {}
    for item in data:
        t = item.get("source_type", "note")
        type_counts[t] = type_counts.get(t, 0) + 1
        for tag in item.get("tags", []):
            all_tags[tag] = all_tags.get(tag, 0) + 1

    top_tags = sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    return {
        "total_documents": len(data),
        "by_type": type_counts,
        "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
    }

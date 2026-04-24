"""
DevOS Shared Backend Utilities
Supabase client, Groq client, embeddings, auth middleware
"""

import os
from functools import lru_cache
from typing import Optional
import httpx
from supabase import create_client, Client
from groq import Groq
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────
# Supabase Client
# ─────────────────────────────────────────
@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)

# ─────────────────────────────────────────
# Groq Client
# ─────────────────────────────────────────
@lru_cache(maxsize=1)
def get_groq() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])

# ─────────────────────────────────────────
# Embedding Model (384-dim, fast, free)
# ─────────────────────────────────────────
@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")

def embed_text(text: str) -> list[float]:
    model = get_embedding_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()

def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return embeddings.tolist()

# ─────────────────────────────────────────
# Groq Chat Helper
# ─────────────────────────────────────────
def groq_chat(
    messages: list[dict],
    model: str = "llama-3.3-70b-versatile",
    temperature: float = 0.3,
    max_tokens: int = 2048,
    system: Optional[str] = None,
) -> str:
    client = get_groq()
    full_messages = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(messages)

    response = client.chat.completions.create(
        model=model,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content

def groq_vision(
    image_base64: str,
    prompt: str,
    media_type: str = "image/png",
    model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
) -> str:
    client = get_groq()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_base64}"
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        max_tokens=2048,
    )
    return response.choices[0].message.content

# ─────────────────────────────────────────
# Health Check Response
# ─────────────────────────────────────────
def health_response(module: str) -> dict:
    return {"status": "healthy", "module": module, "version": "1.0.0"}

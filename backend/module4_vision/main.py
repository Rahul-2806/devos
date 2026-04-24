"""
DevOS Module 4 — System Design Vision Chat
Upload architecture diagram → LLaMA Vision analyzes → chat to improve it
"""

import base64
import json
import os
import re
import sys
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.utils import get_supabase, groq_chat, groq_vision, health_response

app = FastAPI(title="DevOS — System Design Vision Chat", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# Models
# ─────────────────────────────────────────
class ChatRequest(BaseModel):
    diagram_id: str
    message: str
    chat_history: list[dict] = []


class TextAnalysisRequest(BaseModel):
    title: str
    description: str


# ─────────────────────────────────────────
# Vision Analysis
# ─────────────────────────────────────────
ANALYSIS_PROMPT = """You are a principal software architect at Google with 15 years of experience.
Analyze this system design diagram thoroughly and return JSON with EXACTLY this structure:
{
  "components_detected": [
    {"name": "...", "type": "service|database|cache|queue|load_balancer|cdn|client|external", "description": "..."}
  ],
  "bottlenecks": [
    {"location": "...", "severity": "critical|high|medium", "description": "...", "fix": "..."}
  ],
  "spof_list": [
    {"component": "...", "impact": "...", "mitigation": "..."}
  ],
  "overall_score": <0-100>,
  "strengths": ["...", "..."],
  "missing_components": ["...", "..."],
  "scalability_assessment": "...",
  "security_gaps": ["...", "..."],
  "summary": "2-3 sentence overall assessment"
}
Return ONLY valid JSON. Be specific and technical."""


def analyze_diagram_image(image_base64: str, media_type: str = "image/png") -> dict:
    raw = groq_vision(image_base64, ANALYSIS_PROMPT, media_type)
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    try:
        return json.loads(clean)
    except Exception:
        return {
            "components_detected": [],
            "bottlenecks": [],
            "spof_list": [],
            "overall_score": 50,
            "strengths": [],
            "missing_components": [],
            "scalability_assessment": raw,
            "security_gaps": [],
            "summary": "Analysis complete. See scalability assessment for details.",
        }


def chat_with_design(
    analysis: dict,
    user_message: str,
    chat_history: list[dict],
) -> str:
    system = f"""You are a principal software architect helping review and improve a system design.

Current system analysis:
- Components: {json.dumps(analysis.get('components_detected', []))}
- Bottlenecks: {json.dumps(analysis.get('bottlenecks', []))}
- Single Points of Failure: {json.dumps(analysis.get('spof_list', []))}
- Overall Score: {analysis.get('overall_score', 0)}/100
- Summary: {analysis.get('summary', '')}

Answer the user's questions about this specific system. Be concrete, technical, and give actionable advice.
When suggesting improvements, include specific technologies (e.g., "Add Redis Cluster between your API and DB").
Format responses clearly with numbered steps when giving recommendations."""

    messages = []
    for h in chat_history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    return groq_chat(
        messages=messages,
        model="llama-3.3-70b-versatile",
        system=system,
        temperature=0.3,
        max_tokens=1500,
    )


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return health_response("design-vision")


@app.post("/analyze")
async def analyze_diagram(
    file: UploadFile = File(...),
    title: str = Form("My System Design"),
):
    """Upload an image and get full architectural analysis"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    image_base64 = base64.b64encode(contents).decode("utf-8")
    media_type = file.content_type

    # Run vision analysis
    analysis = analyze_diagram_image(image_base64, media_type)

    # Upload image to Supabase Storage
    supabase = get_supabase()
    image_path = f"diagrams/{os.urandom(8).hex()}.png"
    image_url = None

    try:
        storage_resp = supabase.storage.from_("design-diagrams").upload(
            image_path, contents, {"content-type": media_type}
        )
        image_url = supabase.storage.from_("design-diagrams").get_public_url(image_path)
    except Exception:
        pass  # Continue without storage if bucket not set up

    # Store analysis
    result = (
        supabase.table("design_diagrams")
        .insert(
            {
                "title": title,
                "image_url": image_url,
                "image_path": image_path,
                "components_detected": analysis.get("components_detected", []),
                "bottlenecks": analysis.get("bottlenecks", []),
                "spof_list": analysis.get("spof_list", []),
                "overall_score": analysis.get("overall_score", 50),
            }
        )
        .execute()
    )

    diagram_id = result.data[0]["id"]

    # Store initial assistant message
    supabase.table("design_chat_messages").insert({
        "diagram_id": diagram_id,
        "role": "assistant",
        "content": f"I've analyzed your system design. Here's my assessment:\n\n**Overall Score: {analysis.get('overall_score', 0)}/100**\n\n{analysis.get('summary', '')}\n\nI detected {len(analysis.get('components_detected', []))} components, {len(analysis.get('bottlenecks', []))} bottlenecks, and {len(analysis.get('spof_list', []))} single points of failure. Ask me anything about improving this architecture!",
    }).execute()

    return {
        "diagram_id": diagram_id,
        "analysis": analysis,
        "title": title,
        "image_url": image_url,
    }


@app.post("/chat")
def chat_with_diagram(req: ChatRequest):
    """Continue chatting about a diagram"""
    supabase = get_supabase()

    diagram = (
        supabase.table("design_diagrams")
        .select("*")
        .eq("id", req.diagram_id)
        .single()
        .execute()
    )
    if not diagram.data:
        raise HTTPException(status_code=404, detail="Diagram not found")

    d = diagram.data
    analysis = {
        "components_detected": d.get("components_detected", []),
        "bottlenecks": d.get("bottlenecks", []),
        "spof_list": d.get("spof_list", []),
        "overall_score": d.get("overall_score", 50),
        "summary": d.get("description", ""),
    }

    # Store user message
    supabase.table("design_chat_messages").insert({
        "diagram_id": req.diagram_id,
        "role": "user",
        "content": req.message,
    }).execute()

    # Get AI response
    response = chat_with_design(analysis, req.message, req.chat_history)

    # Store assistant response
    supabase.table("design_chat_messages").insert({
        "diagram_id": req.diagram_id,
        "role": "assistant",
        "content": response,
    }).execute()

    return {"response": response, "diagram_id": req.diagram_id}


@app.get("/diagrams")
def list_diagrams(limit: int = 20):
    supabase = get_supabase()
    result = (
        supabase.table("design_diagrams")
        .select("id, title, overall_score, image_url, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"diagrams": result.data}


@app.get("/diagrams/{diagram_id}")
def get_diagram(diagram_id: str):
    supabase = get_supabase()
    diagram = (
        supabase.table("design_diagrams")
        .select("*")
        .eq("id", diagram_id)
        .single()
        .execute()
    )
    if not diagram.data:
        raise HTTPException(status_code=404, detail="Diagram not found")

    messages = (
        supabase.table("design_chat_messages")
        .select("*")
        .eq("diagram_id", diagram_id)
        .order("created_at")
        .execute()
    )

    return {**diagram.data, "messages": messages.data}


@app.delete("/diagrams/{diagram_id}")
def delete_diagram(diagram_id: str):
    supabase = get_supabase()
    supabase.table("design_chat_messages").delete().eq("diagram_id", diagram_id).execute()
    supabase.table("design_diagrams").delete().eq("id", diagram_id).execute()
    return {"success": True}

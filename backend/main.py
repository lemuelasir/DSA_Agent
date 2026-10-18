import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

# Ensure backend directory is in sys.path regardless of execution CWD
backend_dir = str(Path(__file__).parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_engine import generate_dsa_assistance, get_gemini_client, analyze_screen_dsa

app = FastAPI(
    title="DSA Companion AI Backend",
    description="Backend service for DSA desktop companion: problem analysis, hinting, and code debugging",
    version="0.1.0",
)

# Enable CORS for local Electron and Vite renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str


class AIStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str


class ConfigureKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=1, description="Gemini API Key")


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User question or primary guidance query")
    mode: Literal["hint", "debug", "testcase", "learn"] = Field(
        default="hint", description="Assistance mode"
    )
    level: int = Field(default=1, ge=1, le=4, description="Assistance depth (1 to 4)")
    code: Optional[str] = Field(default=None, description="Optional code snippet to debug or analyze")
    language: Optional[str] = Field(default="python", description="Programming language of snippet")
    error: Optional[str] = Field(default=None, description="Optional compiler error, stack trace, or test failure")


class AnalyzeScreenRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded screenshot data URL or raw base64")
    is_idle_check: bool = Field(default=False, description="Whether this analysis was triggered due to idle inactivity")


class ChatResponse(BaseModel):
    status: str
    response: str
    mode: str
    level: int
    source: str
    timestamp: str
    model: Optional[str] = None


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint to verify backend connectivity."""
    return HealthResponse(
        status="ok",
        service="DSA Companion AI Backend",
        version="0.1.0",
        timestamp=datetime.now().isoformat(),
    )


@app.get("/api/ai-status", response_model=AIStatusResponse)
def get_ai_status():
    """Inspect whether an LLM API key is configured."""
    client = get_gemini_client()
    return AIStatusResponse(
        configured=client is not None,
        provider="Google Gemini",
        model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
    )


@app.post("/api/configure-key")
def configure_api_key(req: ConfigureKeyRequest):
    """
    Allow configuring or updating the Gemini API key from the desktop app UI.
    Persists to backend/.env and updates current process environment immediately.
    """
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    os.environ["GEMINI_API_KEY"] = key

    # Persist to backend/.env file
    env_path = Path(__file__).parent / ".env"
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"# Auto-configured by DSA Companion\nGEMINI_API_KEY={key}\nGEMINI_MODEL=gemini-3.8-flash\n")
    except Exception as e:
        print(f"[Backend] Warning saving .env: {e}")

    return {
        "status": "success",
        "message": "Gemini API key configured successfully!",
        "configured": True,
    }


@app.post("/api/chat", response_model=ChatResponse)
def handle_chat(req: ChatRequest):
    """
    Primary endpoint for processing user queries.
    Uses Socratic prompt rules tailored to mode and level.
    """
    clean_prompt = req.prompt.strip()
    if not clean_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt cannot be empty or pure whitespace.",
        )

    # Generate response via AI engine
    result = generate_dsa_assistance(
        prompt=clean_prompt,
        mode=req.mode,
        level=req.level,
        code=req.code.strip() if req.code else None,
        language=req.language.strip() if req.language else "python",
        error=req.error.strip() if req.error else None,
    )

    return ChatResponse(
        status=result["status"],
        response=result["response"],
        mode=req.mode,
        level=req.level,
        source=result["source"],
        model=result.get("model"),
        timestamp=datetime.now().strftime("%I:%M %p"),
    )


@app.post("/api/analyze-screen")
def handle_analyze_screen(req: AnalyzeScreenRequest):
    """Analyze a screenshot of the user's desktop with Gemini Vision."""
    if not req.image.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screenshot image data cannot be empty.",
        )
    return analyze_screen_dsa(req.image, is_idle_check=req.is_idle_check)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from backend/.env or workspace .env
load_dotenv()

# System prompts tailored to Socratic DSA mentoring
BASE_CAT_PERSONA = """You are Byte the Cat 🐱, an encouraging and expert Senior Software Engineer and DSA Coding Mentor.
Your mission is to help Computer Science students master Data Structures & Algorithms, LeetCode problems, and interview debugging.
Tone: Warm, encouraging, concise, and pedagogical. Use friendly cat emojis (🐾, 🐱, 😸) occasionally.

CRITICAL PEDAGOGICAL RULE:
Never give away more than what the student's selected Assistance Level permits!
Respect the student's learning journey by encouraging them to think and build problem-solving muscle.
"""

MODE_INSTRUCTIONS = {
    "hint": """MODE: HINT
Focus on conceptual intuition, pattern recognition, and guiding the student toward the right data structure or technique.
Do NOT reveal the full algorithm or complete solution unless Level 4 is requested.
""",
    "debug": """MODE: DEBUG
Focus on analyzing compilation errors, runtime exceptions, index out-of-bounds, off-by-one errors, and infinite loops.
Distinguish between syntax errors and logical flaws. Formulate hypotheses and encourage debugging experiments.
""",
    "testcase": """MODE: TEST CASE
Focus on tricky test cases, edge cases, minimal inputs, duplicates, negative numbers, and boundary values.
Explain WHY each test case is useful and what potential bug it would catch.
""",
    "learn": """MODE: LEARN
Focus on explaining algorithmic concepts, data structure trade-offs, pattern intuition (e.g. two-pointers vs sliding window), and rigorous Big-O time and space complexity analysis.
""",
}

LEVEL_INSTRUCTIONS = {
    1: """ASSISTANCE LEVEL: 1 (Hint Only)
- Provide ONLY a gentle Socratic hint or guiding question.
- Do NOT provide code or algorithm steps.
- Keep the response short (2-4 sentences).
""",
    2: """ASSISTANCE LEVEL: 2 (Explain the Mistake / Bottleneck)
- Explain exactly what went wrong conceptually or where the bottleneck is.
- Point out the problematic logic or inefficiency.
- Do NOT write the fix or provide code.
""",
    3: """ASSISTANCE LEVEL: 3 (Guide Through the Fix)
- Provide step-by-step guidance on how to fix the bug or implement the optimal approach.
- Use pseudocode or bullet points.
- Do NOT dump the full finished code.
""",
    4: """ASSISTANCE LEVEL: 4 (Detailed Explanation & Full Solution)
- Provide a comprehensive explanation of the optimal approach.
- Provide clean, production-quality, type-annotated code.
- Provide thorough Big-O Time and Space complexity breakdown.
""",
}


def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[AI Engine] Error initializing Gemini client: {e}")
        return None


def generate_dsa_assistance(prompt: str, mode: str, level: int) -> dict:
    """
    Orchestrate AI response generation using Gemini API with Socratic prompt enforcement.
    If no API key is provided, returns helpful configuration instructions.
    """
    client = get_gemini_client()
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    if not client:
        # Graceful fallback explaining how to enable live AI
        guidance = (
            f"🐾 [AI CONFIGURATION NOTICE]\n"
            f"Byte the Cat is ready, but no active LLM API key was detected in `backend/.env`.\n\n"
            f"To enable real-time Gemini AI assistance:\n"
            f"1. Get a free API key at: https://aistudio.google.com/\n"
            f"2. Add your key to `backend/.env`:\n"
            f"   GEMINI_API_KEY=AIzaSy...\n\n"
            f"In the meantime, your request was validated and simulated:\n"
            f"• Mode: {mode.upper()} | Level: {level}\n"
            f"• Query: '{prompt[:60]}...'"
        )
        return {
            "status": "configured_offline",
            "response": guidance,
            "source": "backend-local-guidance",
            "model": "offline-template",
        }

    # Construct Socratic System Instruction
    system_instruction = (
        f"{BASE_CAT_PERSONA}\n\n"
        f"{MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS['hint'])}\n\n"
        f"{LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS[1])}"
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={
                "system_instruction": system_instruction,
                "temperature": 0.4 if mode in ("debug", "testcase") else 0.7,
            },
        )

        return {
            "status": "success",
            "response": response.text or "Purr... I couldn't generate a response. Please try rephrasing your question!",
            "source": "gemini-ai",
            "model": model_name,
        }
    except Exception as err:
        err_str = str(err)
        print(f"[AI Engine Error]: {err_str}")

        # Human-friendly error translation
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            friendly_msg = "⚠️ Gemini API rate limit or quota reached. Please wait a minute before making another request."
        elif "API_KEY_INVALID" in err_str or "400" in err_str and "key" in err_str.lower():
            friendly_msg = "❌ The provided GEMINI_API_KEY appears to be invalid. Please verify your key at https://aistudio.google.com/"
        else:
            friendly_msg = f"⚠️ Gemini AI request failed: {err_str}"

        return {
            "status": "error",
            "response": friendly_msg,
            "source": "gemini-error",
            "model": model_name,
        }

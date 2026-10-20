import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

ENV_FILE = Path(__file__).parent / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
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
The student has provided code and/or an error message to debug a DSA problem.
- Your mission is to help them locate and understand their bug (off-by-one, boundary conditions, infinite loops, recursion base case missing, null pointer dereference, memory overflow, or state corruption).
- If Level 1: Point ONLY to the suspicious loop, pointer, or condition to inspect. Ask a leading question. Never reveal the fix or provide corrected code!
- If Level 2: Pinpoint the exact line or condition and explain WHY it fails under specific input states.
- If Level 3: Provide step-by-step guidance and pseudocode on how to restructure the logic or fix the condition.
- If Level 4: Provide the full, clean, corrected code snippet with comments explaining what changed and why, plus Big-O analysis.
""",
    "testcase": """MODE: TEST CASE GENERATOR
The student is requesting test cases for their DSA problem or code snippet.
- Generate high-value, structured test cases organized into:
  1. Base / Minimal Cases (e.g., empty array, len=1, 0, None)
  2. Boundary & Extreme Cases (e.g., negative values, maximum integer constraints, all identical items, sorted vs reverse-sorted)
  3. Tricky Corner Cases (e.g., duplicate values, target not in array, even vs odd lengths, cycles)
- For every test case, clearly specify:
  - Input: [exact testcase values]
  - Expected Output: [correct output]
  - Catches Bug: [What mistake or edge case does this test expose?]
- Format test cases cleanly so they can easily be copied into LeetCode's 'Testcase' box.
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
    if ENV_FILE.exists():
        load_dotenv(dotenv_path=ENV_FILE)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[AI Engine] Error initializing Gemini client: {e}")
        return None


def call_gemini_with_fallback(client, contents, config=None):
    """
    Calls Gemini generate_content with automatic fallback across models
    if quota exhaustion (429), 404, or 503 occurs.
    """
    configured_model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()
    candidate_models = [configured_model]
    for fallback in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.8-flash"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    last_err = None
    for model_name in candidate_models:
        try:
            kwargs = {}
            if config is not None:
                kwargs["config"] = config
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                **kwargs,
            )
            return response, model_name
        except Exception as err:
            err_str = str(err)
            last_err = err
            print(f"[AI Engine] Model '{model_name}' fallback triggered: {err_str[:90]}")
            if any(term in err_str for term in ["429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND", "503", "UNAVAILABLE"]):
                continue
            raise err

    if last_err:
        raise last_err


def generate_dsa_assistance(
    prompt: str,
    mode: str,
    level: int,
    code: Optional[str] = None,
    language: str = "python",
    error: Optional[str] = None,
) -> dict:
    """
    Orchestrate AI response generation using Gemini API with Socratic prompt enforcement.
    Accepts student prompt, assistance level, code snippet, and error trace.
    """
    client = get_gemini_client()

    # Format user content with optional code and error trace
    content_parts = [prompt]
    if code:
        content_parts.append(f"\n\nStudent's Code ({language}):\n```{language}\n{code}\n```")
    if error:
        content_parts.append(f"\n\nObserved Error / Stack Trace / Output:\n```text\n{error}\n```")
    final_prompt = "\n".join(content_parts)

    if not client:
        # Graceful fallback explaining how to enable live AI
        guidance = (
            f"🐾 [AI CONFIGURATION NOTICE]\n"
            f"Byte the Cat is ready, but no active LLM API key was detected in `backend/.env`.\n\n"
            f"To enable real-time Gemini AI assistance:\n"
            f"1. Get a free API key at: https://aistudio.google.com/\n"
            f"2. Add your key to `backend/.env`:\n"
            f"   GEMINI_API_KEY=AIzaSy...\n\n"
            f"In the meantime, your request was validated:\n"
            f"• Mode: {mode.upper()} | Level: {level}\n"
            f"• Query: '{prompt[:60]}...'"
        )
        if code:
            guidance += f"\n• Code: {len(code)} characters ({language})"
        if error:
            guidance += f"\n• Error: '{error[:50]}...'"

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
        response, used_model = call_gemini_with_fallback(
            client=client,
            contents=final_prompt,
            config={
                "system_instruction": system_instruction,
                "temperature": 0.4 if mode in ("debug", "testcase") else 0.7,
            },
        )

        return {
            "status": "success",
            "response": response.text or "Purr... I couldn't generate a response. Please try rephrasing your question!",
            "source": "gemini-ai",
            "model": used_model,
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
            "model": os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest"),
        }


def analyze_screen_dsa(image_base64: str, is_idle_check: bool = False) -> dict:
    """
    Multimodal visual inspection of the user's desktop screenshot using Gemini Vision.
    Runs every 10 seconds to continuously tell the user observations about their screen,
    and prepares a Socratic hint to be spoken directly in their text bubble when requested.
    """
    client = get_gemini_client()
    if not client:
        return {
            "status": "offline",
            "analysis": {
                "detected": False,
                "is_coding_context": False,
                "has_error": False,
                "is_stuck": False,
                "is_accepted": false,
                "problem_name": "No Problem Detected",
                "error_type": "None",
                "error_summary": "",
                "mood": "idle",
                "cat_speech": "I can't see your screen yet—configure your Gemini API key! 🐱",
                "detailed_hint": "Please set your GEMINI_API_KEY via the Key button to enable screen vision.",
                "suggested_prompt": "Help me with this problem",
            },
        }

    try:
        import base64
        import json
        from google.genai import types

        # Clean base64 header and normalize padding
        if "base64," in image_base64:
            image_base64 = image_base64.split("base64,")[1]

        image_base64 = image_base64.strip().replace("\n", "").replace("\r", "")
        missing_padding = len(image_base64) % 4
        if missing_padding:
            image_base64 += "=" * (4 - missing_padding)

        image_bytes = base64.b64decode(image_base64)
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")

        idle_context = (
            "NOTE: The student has been inactive on this screen for a bit (may be stuck, staring at code, or contemplating logic)."
            if is_idle_check
            else ""
        )

        prompt = f"""You are Byte the Cat 🐱, an attentive AI DSA Coding Companion sitting on the student's desktop, watching their screen in real time.
You analyze their screen every 25 seconds and tell them something live and relevant based on what's visible right now!
{idle_context}

Carefully inspect the desktop screenshot:
1. Is an IDE, text editor, terminal, or DSA platform (LeetCode, HackerRank, Codeforces, NeetCode, etc.) visible?
2. What specific problem, topic, or algorithm are they working on? (e.g. 'Two Sum', 'Binary Search', 'Valid Parentheses', 'Merge Intervals', 'LRU Cache', or topic like Trees, Graphs, Dynamic Programming).
3. What is the user actively doing right now?
   - Reading the problem / constraints? (Comment on constraints like N <= 10^5 or target time complexity).
   - Writing code? (Comment on what data structure, pointer, loop, variable, or logic they are writing).
   - Looking at test cases or running a test?
     - Has a test case failed? Look for 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', red indicators, output vs expected diffs.
     - Has the code been Accepted? Look for green 'Accepted', 'Passed', all tests passed.
   - Staring / idle? (Notice what line they might be thinking about).
   - If not on a coding window (e.g. browser, desktop, discord)? (Give a playful, cute cat remark nudging them to code or acknowledging what they are doing).

Generate structured output:
- "cat_speech": 1-2 short, punchy, conversational sentences for Byte's floating speech text bubble (using playful cat emojis like 🐾, 💡, 🐱, 🚨, ✨).
  CRITICAL: Make the speech SPECIFIC to what is seen on screen right now! Do not be generic. Mention the problem name, loop, variable, testcase, or constraint!
- "detailed_hint": 2-3 sentences of clear, pedagogical Socratic guidance. If the user clicks the "Get Hint" button on the text bubble, this exact hint will be spoken in Byte's text bubble! Give intuition, edge case warnings, or algorithmic pointers without spoiling the full solution code.
- "error_summary": Short summary of any failed testcase (or empty string if none).
- "suggested_prompt": A prompt to explain or verify code if they open the panel (e.g., "Explain how to fix my binary search edge case").
- "mood": "helping" if error/failing test, "thinking" if thinking/stuck, "success" if accepted, or "idle".

Respond ONLY with valid JSON in this exact structure:
{{
  "detected": true,
  "is_coding_context": true,
  "has_error": false,
  "is_stuck": false,
  "is_accepted": false,
  "problem_name": "Problem Title or Topic",
  "error_type": "Wrong Answer / TLE / Runtime Error / Compilation Error / None",
  "error_summary": "Concise summary of failing test case",
  "mood": "helping / thinking / success / idle",
  "cat_speech": "Short, specific speech bubble text here",
  "detailed_hint": "Socratic hint to display in text bubble when user clicks Get Hint",
  "suggested_prompt": "Suggested verification prompt"
}}
"""

        response, used_model = call_gemini_with_fallback(
            client=client,
            contents=[image_part, prompt],
            config={
                "response_mime_type": "application/json",
                "temperature": 0.25,
            },
        )

        raw_text = (response.text or "{}").strip()
        if "```" in raw_text:
            cleaned_lines = [
                line for line in raw_text.splitlines()
                if not line.strip().startswith("```")
            ]
            raw_text = "\n".join(cleaned_lines).strip()

        parsed = json.loads(raw_text)
        speech = parsed.get("cat_speech", "")
        problem = parsed.get("problem_name", "")
        print(f"[AI Vision Observation] Problem: {problem} | Speech: {speech}")

        return {
            "status": "success",
            "analysis": parsed,
            "model": used_model,
        }
    except Exception as e:
        print(f"[AI Vision Error]: {e}")
        return {
            "status": "error",
            "error": str(e),
            "analysis": {
                "detected": False,
                "is_coding_context": False,
                "has_error": False,
                "is_stuck": False,
                "is_accepted": False,
                "problem_name": "Analysis Error",
                "error_type": "None",
                "error_summary": "",
                "mood": "idle",
                "cat_speech": "Purr... My vision got a bit fuzzy! Watching your screen again in 25s. 🐾",
                "detailed_hint": f"Vision analysis encountered an issue: {e}",
                "suggested_prompt": "Help me with my code",
            },
        }



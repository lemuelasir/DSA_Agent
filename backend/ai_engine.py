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
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

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
        response = client.models.generate_content(
            model=model_name,
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


def analyze_screen_dsa(image_base64: str, is_idle_check: bool = False) -> dict:
    """
    Multimodal visual inspection of the user's desktop screenshot using Gemini 3.8 Flash.
    Detects if the user is coding, on LeetCode/IDE, has a failed testcase, or is stuck/idle.
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
                "is_accepted": False,
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
            "NOTE: The student has been on this screen without typing or cursor movement for over 60 seconds (they may be stuck, staring at code, or taking too long with their current logic)."
            if is_idle_check
            else ""
        )

        prompt = f"""You are Byte the Cat 🐱, an AI DSA Coding Companion watching over a student's desktop while they code.
{idle_context}

Analyze this desktop screenshot carefully:
1. Is a coding editor (VS Code, Cursor, IntelliJ, terminal, IDE) or LeetCode / HackerRank / NeetCode / DSA problem visible?
2. Has a test case or execution failed? Look specifically for:
   - 'Wrong Answer', 'Time Limit Exceeded' (TLE), 'Runtime Error', 'Memory Limit Exceeded', 'Compilation Error', red testcase indicators, diffs between Expected vs Output, or stack traces.
3. Has the student's solution been accepted? Look for green 'Accepted', 'Passed', all test cases passing.
4. If they have been idle or taking too long:
   - Are they staring at an unfinished function or complex loop?
   - Formulate a gentle Socratic nudge to unblock them.
5. Identify the problem name or algorithm topic if visible (e.g. 'Two Sum', 'Valid Parentheses', 'LRU Cache', 'Merge Intervals', 'Binary Search').

Generate structured guidance:
- "cat_speech": A short, punchy 1-2 sentence speech bubble message (with friendly cat emojis like 🐾, 💡, 🐱, 🚨) to display directly above Byte the Cat on their desktop.
  - If a test case failed: Acknowledge the failure with empathy and point to the possible edge case or mistake (e.g. "🚨 Wrong Answer on testcase 3! Did you handle duplicate numbers? Click me for a hint! 🐾").
  - If taking too long / stuck: Offer a gentle nudge (e.g. "💡 Pondering that loop condition? Take a breath! Click me for a quick Level 1 hint. 🐾").
  - If accepted: Celebrate warmly (e.g. "🎉 Accepted! All test cases passed! You crushed it! 😸✨").
  - If coding smoothly: A quick supportive remark (e.g. "👀 Watching your code... looking sharp! Keep going! 🐾").
  - If not on a coding window: "Meow! Open LeetCode or your code editor and I'll watch your back! 🐾"
- "detailed_hint": 2-3 sentences of clear, pedagogical Socratic guidance. Explain WHY the edge case fails or what conceptual pattern applies, without dumping the complete code solution.
- "error_summary": If a test failed, provide a concise summary (e.g., "Wrong Answer: Expected [0,1], Got [1,1] on input nums=[3,3], target=6").
- "suggested_prompt": A 1-sentence prompt the student can click to instantly ask Byte in the assistant chat (e.g., "Why did my solution fail on duplicate inputs?").
- "mood": "helping" if error/wrong test case, "thinking" if stuck/pondering, "success" if accepted, or "idle".

Respond ONLY with valid JSON in this exact structure:
{{
  "detected": true,
  "is_coding_context": true,
  "has_error": false,
  "is_stuck": false,
  "is_accepted": false,
  "problem_name": "Problem Title or Topic",
  "error_type": "Wrong Answer / TLE / Runtime Error / Compilation Error / None",
  "error_summary": "Concise summary of failing input/output or error",
  "mood": "helping / thinking / success / idle",
  "cat_speech": "Short speech bubble message here",
  "detailed_hint": "Detailed pedagogical hint for the assistant panel",
  "suggested_prompt": "Suggested question for chat"
}}
"""

        model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        response = client.models.generate_content(
            model=model_name,
            contents=[image_part, prompt],
            config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        )

        raw_text = (response.text or "{}").strip()
        parsed = json.loads(raw_text)

        return {
            "status": "success",
            "analysis": parsed,
            "model": model_name,
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
                "cat_speech": "Purr... My vision got a bit fuzzy! Try again in a moment. 🐾",
                "detailed_hint": f"Vision analysis encountered an issue: {e}",
                "suggested_prompt": "Help me with my code",
            },
        }



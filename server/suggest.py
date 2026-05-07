"""
server/suggest.py — CrewAI multi-agent suggestion pipeline

Generates 3 contextual Japanese reply suggestions using:
  Agent 1 (Analyst)    — reads conversation context + speaker memory
  Agent 2 (Strategist) — decides reply intent/tone
  Agent 3 (Writer)     — writes 3 natural JP replies

Environment variables:
  VLLM_URL      = "http://localhost:8000/v1"   (vLLM OpenAI-compatible endpoint)
  VLLM_MODEL    = "/app/models/llama3.3-70b"   (model path or name)
  SUGGEST_STYLE = "casual"                      (override — usually from packet)
"""

import json
import logging
import os
import re
import random

log = logging.getLogger("miwa.suggest")

VLLM_URL   = os.getenv("VLLM_URL", "http://localhost:8000/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "/app/models/llama3.3-70b")

# ── Static fallback pool ──────────────────────────────────────────────────────
_FALLBACK_POOL = [
    {"jp": "そうですね",        "romaji": "sou desu ne",        "en": "That's right"},
    {"jp": "面白い！",           "romaji": "omoshiroi!",          "en": "Interesting!"},
    {"jp": "もう一回言って",    "romaji": "mou ikkai itte",      "en": "Say that again"},
    {"jp": "マジで？",          "romaji": "maji de?",            "en": "Seriously?"},
    {"jp": "わかった！",        "romaji": "wakatta!",            "en": "Got it!"},
    {"jp": "すごいね",          "romaji": "sugoi ne",            "en": "That's amazing"},
    {"jp": "ちょっと待って",    "romaji": "chotto matte",        "en": "Wait a sec"},
    {"jp": "なるほどね",        "romaji": "naruhodo ne",         "en": "I see / Makes sense"},
    {"jp": "同意します",        "romaji": "doui shimasu",        "en": "I agree"},
    {"jp": "もっと教えて",      "romaji": "motto oshiete",       "en": "Tell me more"},
    {"jp": "草ｗ",              "romaji": "kusa w",              "en": "lol"},
    {"jp": "ナイス！",          "romaji": "naisu!",              "en": "Nice!"},
]

_STYLE_DESCRIPTIONS = {
    "formal":  "very polite, keigo (敬語), professional",
    "neutral": "natural, standard Japanese, neither too formal nor too casual",
    "casual":  "casual, friendly, like talking to a close friend",
    "gaming":  "gaming slang, fast-paced, uses katakana loanwords and gaming terms",
}


def _fallback_suggestions(exclude: list | None = None) -> list[dict]:
    pool = [s for s in _FALLBACK_POOL if s not in (exclude or [])]
    if len(pool) < 3:
        pool = _FALLBACK_POOL
    return random.sample(pool, min(3, len(pool)))


def _build_prompt(
    jp_text: str,
    en_text: str,
    style: str,
    memories: list[dict],
) -> str:
    """Build the LLM prompt for suggestion generation."""
    style_desc = _STYLE_DESCRIPTIONS.get(style, _STYLE_DESCRIPTIONS["casual"])
    
    memory_block = ""
    if memories:
        recent = memories[:3]
        lines = [f"- JP: {m['jp']} → EN: {m['en']}" for m in recent]
        memory_block = "\nRecent context from this speaker:\n" + "\n".join(lines)

    return f"""You are an expert Japanese conversation assistant helping a non-Japanese speaker reply to a friend in a Discord voice call.

The friend just said:
- Japanese: {jp_text}
- English meaning: {en_text}
{memory_block}

Reply style: {style} ({style_desc})

Generate exactly 3 short, natural Japanese reply suggestions (5-15 words each).
Each suggestion must be something the user would actually say in this conversation.
Vary the intent: e.g. agreement, question, reaction, continuation.

Respond with ONLY valid JSON in this exact format:
{{
  "suggestions": [
    {{"jp": "日本語テキスト", "romaji": "romanized text", "en": "English meaning"}},
    {{"jp": "日本語テキスト", "romaji": "romanized text", "en": "English meaning"}},
    {{"jp": "日本語テキスト", "romaji": "romanized text", "en": "English meaning"}}
  ]
}}"""


def _call_vllm(prompt: str) -> list[dict] | None:
    """Call vLLM directly via OpenAI-compatible REST API (no CrewAI overhead)."""
    try:
        import requests as req

        resp = req.post(
            f"{VLLM_URL}/chat/completions",
            json={
                "model": VLLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,
                "temperature": 0.8,
                "top_p": 0.95,
            },
            timeout=10,
        )
        resp.raise_for_status()

        content = resp.json()["choices"][0]["message"]["content"].strip()

        # Extract JSON from response (model may wrap it in markdown)
        json_match = re.search(r'\{[\s\S]*\}', content)
        if not json_match:
            log.warning(f"No JSON found in vLLM response: {content[:200]}")
            return None

        parsed = json.loads(json_match.group())
        suggestions = parsed.get("suggestions", [])

        # Validate structure
        valid = []
        for s in suggestions:
            if (
                isinstance(s, dict)
                and isinstance(s.get("jp"), str)
                and isinstance(s.get("romaji"), str)
                and isinstance(s.get("en"), str)
                and len(s["jp"]) <= 200
                and len(s["en"]) <= 200
            ):
                valid.append({
                    "jp":     s["jp"].strip(),
                    "romaji": s["romaji"].strip(),
                    "en":     s["en"].strip(),
                })

        return valid[:3] if len(valid) >= 1 else None

    except Exception as e:
        log.warning(f"vLLM call failed: {e}")
        return None


def _call_crewai(
    jp_text: str,
    en_text: str,
    style: str,
    memories: list[dict],
) -> list[dict] | None:
    """
    Multi-agent CrewAI pipeline for richer suggestion generation.
    Uses 3 sequential agents for Track 1 (AI Agents & Agentic Workflows).
    """
    try:
        from crewai import Agent, Task, Crew, LLM

        llm = LLM(
            model=f"openai/{VLLM_MODEL}",
            base_url=VLLM_URL,
            api_key="not-required",  # vLLM doesn't require a real key
            temperature=0.7,
            max_tokens=600,
        )

        style_desc = _STYLE_DESCRIPTIONS.get(style, _STYLE_DESCRIPTIONS["casual"])
        
        memory_ctx = ""
        if memories:
            lines = [f"- {m['jp']} ({m['en']})" for m in memories[:3]]
            memory_ctx = "Past context: " + "; ".join(lines)

        # Agent 1: Analyst — understands the conversation
        analyst = Agent(
            role="Japanese Conversation Analyst",
            goal="Analyze the current conversation and identify the best reply opportunities",
            backstory=(
                "You are fluent in Japanese and English. "
                "You understand Discord gaming culture and casual Japanese speech patterns."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        # Agent 2: Strategist — decides reply angles
        strategist = Agent(
            role="Reply Strategist",
            goal="Decide 3 distinct reply intents that would fit naturally in this conversation",
            backstory=(
                "You craft conversation strategies for language learners. "
                "You pick diverse intents: one reaction, one question, one continuation."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        # Agent 3: Writer — writes the actual Japanese
        writer = Agent(
            role="Japanese Reply Writer",
            goal=f"Write 3 natural Japanese replies in {style} ({style_desc}) style",
            backstory=(
                "You are a native Japanese speaker who writes natural, "
                "conversational Japanese appropriate for the given style and context."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        task1 = Task(
            description=(
                f"The user's Japanese friend said: '{jp_text}' (meaning: '{en_text}'). "
                f"{memory_ctx} "
                "Identify: 1) the emotion/intent of what was said, "
                "2) what kind of reply would feel most natural, "
                "3) any relevant cultural context."
            ),
            expected_output="A brief analysis of the conversation context and reply opportunities.",
            agent=analyst,
        )

        task2 = Task(
            description=(
                "Based on the analyst's findings, decide 3 distinct reply intents. "
                f"Style must be: {style} ({style_desc}). "
                "Intents should vary: e.g. agreement, clarifying question, emotional reaction."
            ),
            expected_output="3 numbered reply intents with brief rationale.",
            agent=strategist,
            context=[task1],
        )

        task3 = Task(
            description=(
                "Write the 3 Japanese replies based on the strategist's intents. "
                f"Style: {style} ({style_desc}). "
                "Each reply: 5-15 words, natural, conversational. "
                "Output ONLY valid JSON:\n"
                '{"suggestions": [{"jp": "...", "romaji": "...", "en": "..."}, ...]}'
            ),
            expected_output='Valid JSON with 3 suggestions: {"suggestions": [...]}',
            agent=writer,
            context=[task1, task2],
        )

        crew = Crew(
            agents=[analyst, strategist, writer],
            tasks=[task1, task2, task3],
            verbose=False,
        )

        result = crew.kickoff()
        raw = str(result)

        # Extract JSON
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            log.warning("CrewAI returned no JSON — falling back to direct vLLM")
            return None

        parsed = json.loads(json_match.group())
        suggestions = parsed.get("suggestions", [])

        valid = []
        for s in suggestions:
            if isinstance(s, dict) and s.get("jp") and s.get("en"):
                valid.append({
                    "jp":     str(s["jp"]).strip()[:200],
                    "romaji": str(s.get("romaji", "")).strip()[:200],
                    "en":     str(s["en"]).strip()[:200],
                })

        return valid[:3] if len(valid) >= 1 else None

    except ImportError:
        log.warning("crewai not installed — falling back to direct vLLM")
        return None
    except Exception as e:
        log.error(f"CrewAI pipeline failed: {e}")
        return None


def translate_with_style(jp_text: str, en_fast: str, style: str) -> str | None:
    """
    Use vLLM to produce a style-adjusted English translation.
    Falls back to en_fast (Google Translate) if vLLM is unavailable.
    """
    style_desc = _STYLE_DESCRIPTIONS.get(style, _STYLE_DESCRIPTIONS["casual"])
    prompt = (
        f"Translate the following Japanese text to English.\n"
        f"Style: {style} ({style_desc})\n"
        f"Japanese: {jp_text}\n"
        f"Base translation: {en_fast}\n\n"
        f"Rules:\n"
        f"- Adjust the tone to match the style ({style})\n"
        f"- Keep the same meaning as the base translation\n"
        f"- Reply with ONLY the translated English text, nothing else\n"
        f"- Do not add quotes, explanations, or labels\n"
        f"Translation:"
    )
    try:
        import requests as req
        resp = req.post(
            f"{VLLM_URL}/chat/completions",
            json={
                "model": VLLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 120,
                "temperature": 0.4,
            },
            timeout=8,
        )
        resp.raise_for_status()
        result = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip any accidental quotes or labels
        result = result.strip('"\'').strip()
        if result and len(result) < 500:
            return result
    except Exception as e:
        log.warning(f"translate_with_style failed: {e}")
    return None


def get_suggestions(
    jp_text:  str,
    en_text:  str,
    style:    str = "casual",
    memories: list[dict] | None = None,
    use_agents: bool = True,
) -> list[dict]:
    """
    Public API — get 3 reply suggestions for a given utterance.

    Args:
        jp_text:    Japanese text that was said
        en_text:    English translation
        style:      "formal" | "neutral" | "casual" | "gaming"
        memories:   Past utterances from this speaker (from memory.py)
        use_agents: If True, try CrewAI first; if False, go direct vLLM

    Returns list of 3 { jp, romaji, en } dicts.
    Always returns 3 results (falls back to static pool).
    """
    # Input validation
    if not jp_text or not isinstance(jp_text, str):
        return _fallback_suggestions()
    if style not in _STYLE_DESCRIPTIONS:
        style = "casual"
    memories = memories or []

    # Try CrewAI (full multi-agent)
    if use_agents:
        result = _call_crewai(jp_text, en_text, style, memories)
        if result and len(result) == 3:
            log.info("Suggestions from CrewAI ✓")
            return result
        log.info("CrewAI failed/incomplete — trying direct vLLM")

    # Try direct vLLM
    prompt = _build_prompt(jp_text, en_text, style, memories)
    result = _call_vllm(prompt)
    if result and len(result) >= 1:
        # Pad to 3 if needed
        while len(result) < 3:
            result.append(random.choice(_FALLBACK_POOL))
        log.info(f"Suggestions from vLLM ✓ ({len(result)} returned)")
        return result[:3]

    # Final fallback
    log.info("Using static suggestion pool (no cloud)")
    return _fallback_suggestions()
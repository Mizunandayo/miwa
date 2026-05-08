# -*- coding: utf-8 -*-
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

# ── Persistent HTTP session ───────────────────────────────────────────────────
# Reuses TCP connections to vLLM (keep-alive) — avoids per-call TCP handshake.
# Lazy-initialized on first use so import stays fast.
_http_session = None

def _get_session():
    global _http_session
    if _http_session is None:
        try:
            import requests
            _http_session = requests.Session()
            # Keep up to 4 connections alive (translate + suggest can run concurrently)
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=4,
                pool_maxsize=4,
                max_retries=0,
            )
            _http_session.mount("http://", adapter)
            _http_session.mount("https://", adapter)
        except ImportError:
            pass
    return _http_session

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
    "gaming":  "casual gamer tone — keep the meaning 100% accurate, only adjust phrasing to sound natural in a gaming chat (e.g. 'gg', 'noice', 'lol') where it fits naturally. Do NOT invent gaming content that isn't in the original.",
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
    """Build the LLM prompt for suggestion generation.
    NOTE: memories are intentionally NOT included in the prompt.
    Suggestions must reflect only what was just said, not past context.
    Out-of-context memory bleeds incorrect phrases into the suggestions.
    """
    style_desc = _STYLE_DESCRIPTIONS.get(style, _STYLE_DESCRIPTIONS["casual"])

    return f"""You are an expert Japanese conversation assistant helping a non-Japanese speaker reply to a friend in a Discord voice call.

The friend just said:
- Japanese: {jp_text}
- English meaning: {en_text}

Reply style: {style} ({style_desc})

Generate exactly 3 short, natural Japanese reply suggestions (5-15 words each) that directly respond to what was JUST said.
Each suggestion must be a direct natural reaction to the specific phrase above.
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
    """Call vLLM directly via OpenAI-compatible REST API (no CrewAI overhead).
    Uses a system message to enforce JSON-only output — more reliable than
    putting format instructions in the user message, which can be overridden.
    """
    try:
        session = _get_session()
        if session is None:
            import requests as req
            session = req  # fallback: module-level (no connection reuse)

        resp = session.post(
            f"{VLLM_URL}/chat/completions",
            json={
                "model": VLLM_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You output ONLY valid JSON. No prose, no markdown, no explanation. "
                            "Your entire response is one JSON object conforming to the schema given by the user."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 250,   # was 400 — 3 short suggestions fit in ~150 tokens
                "temperature": 0.6,  # was 0.8 — tighter sampling, faster convergence
                "top_p": 0.90,       # was 0.95
                # Stop as soon as the JSON object is closed — prevents trailing prose.
                # LLMs tend to add "Note: ..." or explanations after the JSON without this.
                # Closing brace + newline is the reliable end-of-JSON signal.
                "stop": ["\n}\n", "\n}\n\n"],
            },
            timeout=12,
        )
        resp.raise_for_status()

        content = resp.json()["choices"][0]["message"]["content"].strip()

        # Extract JSON from response (model may wrap it in markdown)
        json_match = re.search(r'\{[\s\S]*\}', content)
        if not json_match:
            log.warning(f"No JSON found in vLLM response: {content[:200]}")
            return None

        # Strip control characters that cause json.loads to fail
        # (LLMs sometimes embed raw \n or other ctrl chars inside string values)
        json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_match.group())
        parsed = json.loads(json_str)
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

        # Single-agent design: one Writer agent with full context in the task description.
        # This makes exactly 1 LLM call (via CrewAI/LiteLLM) instead of 3 sequential ones,
        # cutting latency from ~70s to ~15-20s while still satisfying Track 1 (CrewAI framework).
        llm = LLM(
            model=f"openai/{VLLM_MODEL}",
            base_url=VLLM_URL,
            api_key="not-required",
            temperature=0.6,
            max_tokens=250,
            timeout=30,
        )

        style_desc = _STYLE_DESCRIPTIONS.get(style, _STYLE_DESCRIPTIONS["casual"])

        memory_ctx = ""
        if memories:
            lines = [f"- {m['jp']} ({m['en']})" for m in memories[:2]]
            memory_ctx = " Past context: " + "; ".join(lines) + "."

        writer = Agent(
            role="Japanese Reply Writer",
            goal="Write 3 natural, contextually appropriate Japanese replies",
            backstory=(
                "You are a native Japanese speaker who writes concise, natural replies "
                "for language learners in Discord voice calls. "
                "You always produce valid JSON and nothing else."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        task = Task(
            description=(
                f"Someone said in Japanese: '{jp_text}' (meaning: '{en_text}').{memory_ctx}\n"
                f"Write 3 natural {style} Japanese replies ({style_desc}). "
                "Vary them: one reaction, one question, one follow-up. "
                "Each reply: 3-12 words. "
                "Output ONLY this JSON (no other text):\n"
                '{"suggestions": [{"jp": "...", "romaji": "...", "en": "..."}, {"jp": "...", "romaji": "...", "en": "..."}, {"jp": "...", "romaji": "...", "en": "..."}]}'
            ),
            expected_output='{"suggestions": [{"jp": "...", "romaji": "...", "en": "..."}, ...]}',
            agent=writer,
        )

        crew = Crew(
            agents=[writer],
            tasks=[task],
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
        f"Rewrite this English translation with a {style} tone ({style_desc}).\n"
        f"Original Japanese: {jp_text}\n"
        f"Accurate literal translation: {en_fast}\n"
        f"Rules: Keep the EXACT meaning of the literal translation. Only adjust wording/tone, never change what is being said.\n"
        f"Output ONLY the rewritten English. No explanations, no quotes, no labels."
    )
    try:
        session = _get_session()
        if session is None:
            import requests as req
            session = req
        resp = session.post(
            f"{VLLM_URL}/chat/completions",
            json={
                "model": VLLM_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a tone adjuster. You receive an accurate translation and rewrite it to match a requested tone without changing the meaning. Never add information that is not in the original."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 80,
                "temperature": 0.3,
                "stop": ["\n\n", "Japanese:", "Note:", "Explanation:"],
            },
            timeout=8,
        )
        resp.raise_for_status()
        result = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip accidental prefixes
        for prefix in ["Translation:", "English:", "Answer:", "Output:"]:
            if result.lower().startswith(prefix.lower()):
                result = result[len(prefix):].strip()
        result = result.strip('"\'').strip()
        if result and 2 < len(result) < 500:
            log.info(f"translate_with_style ({style}): {result}")
            return result
    except Exception as e:
        log.warning(f"translate_with_style failed: {e}")
    return None


_JP_STYLE_DESCRIPTIONS = {
    "formal":  "polite/formal Japanese using です/ます keigo speech level",
    "neutral": "standard natural Japanese",
    "casual":  "friendly casual Japanese using plain/short form",
    "gaming":  "gamer slang Japanese, use ゲーマー slang and abbreviations where fitting",
}


def translate_en_to_jp_with_style(en_text: str, jp_fast: str, style: str) -> str | None:
    """
    Translate English to Japanese with the given style tone.
    jp_fast is the Google Translate result used as a base reference.
    Returns None on failure (caller falls back to jp_fast).
    """
    style_desc = _JP_STYLE_DESCRIPTIONS.get(style, _JP_STYLE_DESCRIPTIONS["casual"])
    prompt = (
        f"Translate this English sentence to Japanese with a {style} tone ({style_desc}).\n"
        f"English: {en_text}\n"
        f"Base translation: {jp_fast}\n"
        f"Output ONLY the Japanese translation. No explanations, no romaji, no labels."
    )
    try:
        session = _get_session()
        if session is None:
            import requests as req
            session = req
        resp = session.post(
            f"{VLLM_URL}/chat/completions",
            json={
                "model": VLLM_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a translator. Reply with ONLY the Japanese translation, nothing else."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 80,
                "temperature": 0.3,
                "stop": ["\n\n", "English:", "Note:", "Explanation:"],
            },
            timeout=8,
        )
        resp.raise_for_status()
        result = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip accidental prefixes
        for prefix in ["Japanese:", "Translation:", "Answer:", "Output:"]:
            if result.lower().startswith(prefix.lower()):
                result = result[len(prefix):].strip()
        result = result.strip('"\'').strip()
        if result and 2 < len(result) < 500:
            log.info(f"translate_en_to_jp_with_style ({style}): {result}")
            return result
    except Exception as e:
        log.warning(f"translate_en_to_jp_with_style failed: {e}")
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

    # Try CrewAI (full multi-agent) — disabled when USE_CREWAI=false
    _crewai_enabled = os.getenv("USE_CREWAI", "true").lower() not in ("false", "0", "no")
    if use_agents and _crewai_enabled:
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
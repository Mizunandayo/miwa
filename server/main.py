"""
server/main.py — Miwa FastAPI WebSocket Server
Runs locally during development, on AMD cloud in production.
"""

import asyncio
import base64
import json
import logging
import os
import random
import time
from typing import Optional

import pykakasi
# ─── Day 5 module imports ─────────────────────────────────────────────────────
from transcribe import transcribe
from memory    import store as memory_store, recall as memory_recall
from suggest   import get_suggestions, translate_with_style, translate_en_to_jp_with_style
from tts       import synthesize as tts_synthesize
from fastapi   import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response
from pydantic  import BaseModel

import requests
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("miwa-server")

# ─── Config ───────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
MAX_AUDIO_BYTES = 2 * 1024 * 1024  # 2MB limit — prevents memory attacks
MAX_TEXT_LENGTH = 500               # Characters

if not GOOGLE_API_KEY:
    log.warning("GOOGLE_TRANSLATE_API_KEY not set — translations will be stubbed")

# ─── pykakasi setup ───────────────────────────────────────────────────────────
kks = pykakasi.kakasi()

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Miwa Server", version="0.1.0")

# Allow WebSocket from localhost only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Limit concurrent vLLM (translate + suggestions) calls to avoid queue stacking
# when multiple speakers fire simultaneously.
_vllm_semaphore = asyncio.Semaphore(2)

# Track active connections (userId → WebSocket)
active_connections: dict[str, WebSocket] = {}

# ─── Helpers ──────────────────────────────────────────────────────────────────

# ─── Stub suggestion pool (replaced by CrewAI on Day 5) ──────────────────────
SUGGESTION_POOL = [
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


def pick_suggestions(exclude: list | None = None) -> list:
    """Pick 3 random suggestions, optionally excluding ones already shown."""
    pool = [s for s in SUGGESTION_POOL if s not in (exclude or [])]
    if len(pool) < 3:
        pool = SUGGESTION_POOL  # fallback: full pool
    return random.sample(pool, min(3, len(pool)))


def validate_payload(data: dict) -> tuple[bool, str]:
    """Validate incoming WebSocket payload. Returns (is_valid, error_message)."""
    msg_type = data.get("type")
    if msg_type not in ("text", "audio", "quick_reply", "refresh_suggestions"):
        return False, f"Invalid type: {msg_type}"

    user_id = data.get("userId", "")
    if msg_type not in ("quick_reply", "refresh_suggestions") and (not user_id or not isinstance(user_id, str) or len(user_id) > 64):
        return False, "Invalid userId"

    if msg_type == "text":
        text = data.get("text", "")
        if not text or not isinstance(text, str):
            return False, "Missing text field"
        if len(text) > MAX_TEXT_LENGTH:
            return False, f"Text too long (max {MAX_TEXT_LENGTH} chars)"

    if msg_type == "audio":
        audio_b64 = data.get("audio", "")
        if not audio_b64:
            return False, "Missing audio field"
        # Check decoded size
        try:
            audio_bytes = base64.b64decode(audio_b64)
            if len(audio_bytes) > MAX_AUDIO_BYTES:
                return False, f"Audio too large (max 2MB)"
        except Exception:
            return False, "Invalid base64 audio"

    return True, ""


def to_romaji(text: str) -> str:
    """Convert Japanese text to Hepburn romanization."""
    try:
        result = kks.convert(text)
        parts = []
        for item in result:
            hepburn = item.get("hepburn", "").strip()
            if hepburn:
                parts.append(hepburn)
        return " ".join(parts)
    except Exception as e:
        log.error(f"Romaji conversion failed: {e}")
        return ""


def google_translate(text: str, target: str = "en") -> Optional[str]:
    """Fast first-pass translation via Google Cloud Translation API."""
    if not GOOGLE_API_KEY:
        return f"[Translation stub: {text}]"

    try:
        resp = requests.post(
            "https://translation.googleapis.com/language/translate/v2",
            params={"key": GOOGLE_API_KEY},
            json={
                "q": text,
                "target": target,
                "format": "text",
            },
            timeout=5,  # Fail fast — this is the instant pass
        )
        resp.raise_for_status()
        return resp.json()["data"]["translations"][0]["translatedText"]
    except requests.Timeout:
        log.warning("Google Translate timed out")
        return None
    except Exception as e:
        log.error(f"Google Translate error: {e}")
        return None


def transcribe_stub(audio_bytes: bytes) -> str:
    """
    Transcription stub — returns a test phrase.
    REPLACE THIS with WhisperX when running on AMD cloud.
    """
    log.info(f"Transcribe stub called with {len(audio_bytes)} bytes audio")
    return "おはようございます"  # Hardcoded for local testing


def tokenize_words(text: str) -> list[dict]:
    """
    Tokenize Japanese text into words with position indices for karaoke.
    Returns list of {word, romaji, index}
    """
    try:
        result = kks.convert(text)
        words = []
        for i, item in enumerate(result):
            orig = item.get("orig", "").strip()
            hepburn = item.get("hepburn", "").strip()
            if orig and orig.strip():
                words.append({
                    "word": orig,
                    "romaji": hepburn,
                    "index": i,
                })
        return words
    except Exception as e:
        log.error(f"Tokenization failed: {e}")
        return [{"word": text, "romaji": "", "index": 0}]


# ─── Translation Pipeline (runs as concurrent task) ──────────────────────────
async def _process_translation(
    data: dict,
    websocket: WebSocket,
    user_id: str,
    start_time: float,
) -> None:
    """
    Full translation pipeline for one audio/text packet.
    Runs as a concurrent asyncio task so the while loop can immediately
    process the next speaker's audio — enabling multi-speaker parallelism.
    """
    try:
        loop = asyncio.get_event_loop()
        style = data.get("style", "casual")

        # ── Transcribe or use provided text ─────────────────────────────────
        if data["type"] == "text":
            jp_text = data["text"].strip()
        else:
            audio_bytes = base64.b64decode(data["audio"])
            transcribe_result = await loop.run_in_executor(
                None, lambda: transcribe(audio_bytes)
            )
            jp_text = transcribe_result.get("text", "").strip()
            if not jp_text:
                return  # silence / noise — drop silently

        # ── Tokenize + romaji ───────────────────────────────────────────────
        word_tokens = tokenize_words(jp_text)
        romaji = to_romaji(jp_text)

        # ── Google Translate (fast first pass) ──────────────────────────────
        en_fast = google_translate(jp_text)
        gt_latency = round((time.time() - start_time) * 1000)

        await websocket.send_text(json.dumps({
            "type": "fast",
            "userId": user_id,
            "jp": jp_text,
            "en": en_fast or jp_text,
            "romaji": romaji,
            "words": word_tokens,
            "translationSource": "google",
            "latencyMs": gt_latency,
            "style": style,
        }))
        log.info(f"[{user_id}] fast packet sent in {gt_latency}ms")

        # ── Fire memory_store without awaiting ──────────────────────────────
        loop.run_in_executor(
            None, lambda: memory_store(user_id, jp_text, en_fast or "", style)
        )

        # ── Recall memory in background while translation runs ──────────────
        memory_recall_future = loop.run_in_executor(
            None, lambda: memory_recall(user_id, jp_text)
        )

        # ── Style translation (vLLM, under semaphore) ───────────────────────
        async with _vllm_semaphore:
            en_refined = await loop.run_in_executor(
                None,
                lambda: translate_with_style(jp_text, en_fast or jp_text, style)
            )

        en_final = en_refined or en_fast or jp_text
        refined_latency = round((time.time() - start_time) * 1000)

        await websocket.send_text(json.dumps({
            "type": "refined",
            "userId": user_id,
            "en": en_final,
            "suggestions": [],
            "translationSource": "llm",
            "latencyMs": refined_latency,
        }))
        log.info(f"[{user_id}] refined packet sent in {refined_latency}ms")

        # ── Suggestions (deferred, vLLM, under semaphore) ───────────────────
        memories = await memory_recall_future
        async with _vllm_semaphore:
            suggestions = await loop.run_in_executor(
                None,
                lambda: get_suggestions(
                    jp_text=jp_text,
                    en_text=en_final,
                    style=style,
                    memories=memories,
                )
            )
        total_latency = round((time.time() - start_time) * 1000)

        await websocket.send_text(json.dumps({
            "type": "refined",
            "userId": user_id,
            "suggestionsOnly": True,
            "suggestions": suggestions,
            "latencyMs": total_latency,
        }))
        log.info(f"[{user_id}] suggestions packet sent in {total_latency}ms")

    except Exception as e:
        log.error(f"[{user_id}] Translation pipeline error: {e}")


# ─── WebSocket Endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    user_id = None
    client_host = websocket.client.host if websocket.client else "unknown"
    log.info(f"New WebSocket connection from {client_host}")

    # Security: only accept from localhost / Docker gateway (172.17.0.1 = host→container tunnel)
    if client_host not in ("127.0.0.1", "::1", "localhost", "172.17.0.1"):
        log.warning(f"Rejected connection from non-localhost: {client_host}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        while True:
            # Receive message — no idle timeout, this is a persistent connection
            try:
                raw = await websocket.receive_text()
            except Exception:
                break

            # Parse JSON
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON"
                }))
                continue

            # Validate payload
            is_valid, error = validate_payload(data)
            if not is_valid:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": error
                }))
                continue

            user_id = data.get("userId", "quick_reply_user")
            active_connections[user_id] = websocket
            start_time = time.time()

            # ── Refresh suggestions ────────────────────────────────────────
            if data["type"] == "refresh_suggestions":
                target_user = data.get("userId", "").strip()
                if not target_user:
                    continue
                new_suggestions = pick_suggestions()
                await websocket.send_text(json.dumps({
                    "type": "refined",
                    "userId": target_user,
                    "suggestionsOnly": True,
                    "suggestions": new_suggestions,
                    "latencyMs": 0,
                }))
                continue

            # ── Quick reply: EN → JP ───────────────────────────────────────
            if data["type"] == "quick_reply":
                en_text = data.get("text", "").strip()
                style   = data.get("style", "casual").lower().strip()
                if style not in ("formal", "neutral", "casual", "gaming"):
                    style = "casual"
                if not en_text:
                    continue
                # Send GT result immediately (fast)
                jp_fast = google_translate(en_text, target="ja") or en_text
                romaji_fast = to_romaji(jp_fast)
                await websocket.send_text(json.dumps({
                    "type": "quick_reply_result",
                    "jp": jp_fast,
                    "romaji": romaji_fast,
                    "en": en_text,
                    "latencyMs": round((time.time() - start_time) * 1000),
                }))
                # Fire vLLM style update in background (non-blocking)
                async def _send_styled_quick_reply(ws, _en, _jp_fast, _style, _t0):
                    try:
                        loop = asyncio.get_event_loop()
                        jp_styled = await asyncio.wait_for(
                            loop.run_in_executor(None, lambda: translate_en_to_jp_with_style(_en, _jp_fast, _style)),
                            timeout=6.0,
                        )
                        if jp_styled and jp_styled != _jp_fast:
                            romaji_s = to_romaji(jp_styled)
                            await ws.send_text(json.dumps({
                                "type": "quick_reply_result",
                                "jp": jp_styled,
                                "romaji": romaji_s,
                                "en": _en,
                                "latencyMs": round((asyncio.get_event_loop().time() - _t0) * 1000),
                            }))
                    except Exception:
                        pass  # silently fall back to already-sent GT result
                asyncio.create_task(_send_styled_quick_reply(websocket, en_text, jp_fast, style, time.time()))
                continue

            # Dispatch full translation pipeline as a concurrent asyncio task.
            # This immediately frees the while loop to receive the next packet —
            # essential for handling multiple speakers firing simultaneously.
            asyncio.create_task(_process_translation(data, websocket, user_id, start_time))

    except WebSocketDisconnect:
        log.info(f"WebSocket disconnected: {user_id}")
    except Exception as e:
        log.error(f"WebSocket error for {user_id}: {e}")
    finally:
        if user_id and user_id in active_connections:
            del active_connections[user_id]


@app.get("/health")
async def health():
    return {"status": "ok", "connections": len(active_connections)}


# ─── TTS Endpoint ─────────────────────────────────────────────────────────────

class TtsRequest(BaseModel):
    text: str

@app.post("/tts")
async def tts_endpoint(req: TtsRequest):
    """Synthesize Japanese text to WAV audio. Called by bot/tts.js."""
    text = req.text.strip()[:200]
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    wav_bytes = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: tts_synthesize(text)
    )

    if wav_bytes is None:
        raise HTTPException(status_code=503, detail="TTS unavailable")

    # Cap response size — 10MB max
    if len(wav_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=500, detail="TTS output too large")

    return Response(content=wav_bytes, media_type="audio/mpeg")


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="info")
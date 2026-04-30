"""
server/main.py — Miwa FastAPI WebSocket Server
Runs locally during development, on AMD cloud in production.
"""

import asyncio
import base64
import json
import logging
import os
import time
from typing import Optional

import pykakasi
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
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

# Track active connections (userId → WebSocket)
active_connections: dict[str, WebSocket] = {}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def validate_payload(data: dict) -> tuple[bool, str]:
    """Validate incoming WebSocket payload. Returns (is_valid, error_message)."""
    msg_type = data.get("type")
    if msg_type not in ("text", "audio"):
        return False, f"Invalid type: {msg_type}"

    user_id = data.get("userId", "")
    if not user_id or not isinstance(user_id, str) or len(user_id) > 64:
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
                "source": "ja",
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


# ─── WebSocket Endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    user_id = None
    client_host = websocket.client.host if websocket.client else "unknown"
    log.info(f"New WebSocket connection from {client_host}")

    # Security: only accept from localhost
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        log.warning(f"Rejected connection from non-localhost: {client_host}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        while True:
            # Receive message with size limit
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30s idle timeout
                )
            except asyncio.TimeoutError:
                log.info(f"WebSocket idle timeout for {user_id}")
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

            user_id = data["userId"]
            active_connections[user_id] = websocket
            start_time = time.time()

            # ── Get Japanese text ──────────────────────────────────────────
            if data["type"] == "text":
                jp_text = data["text"].strip()
            else:
                # Audio path — decode base64 PCM and transcribe
                audio_bytes = base64.b64decode(data["audio"])
                jp_text = transcribe_stub(audio_bytes)  # ← replace with WhisperX

            # ── Tokenize for karaoke ───────────────────────────────────────
            word_tokens = tokenize_words(jp_text)

            # ── Romaji ────────────────────────────────────────────────────
            romaji = to_romaji(jp_text)

            # ── Google Translate (fast first pass) ────────────────────────
            en_fast = google_translate(jp_text)
            gt_latency = round((time.time() - start_time) * 1000)

            # Send FAST packet immediately
            await websocket.send_text(json.dumps({
                "type": "fast",
                "userId": user_id,
                "jp": jp_text,
                "en": en_fast or jp_text,  # fallback to JP if GT fails
                "romaji": romaji,
                "words": word_tokens,
                "translationSource": "google",
                "latencyMs": gt_latency,
                "style": data.get("style", "casual"),
            }))

            log.info(f"[{user_id}] fast packet sent in {gt_latency}ms")

            # ── Refined packet (vLLM stub — will be real on cloud) ────────
            # TODO Day 5: Replace with actual vLLM call via SSH tunnel
            # For now, send the same GT result as "refined" after short delay
            await asyncio.sleep(0.1)  # simulate refinement delay
            total_latency = round((time.time() - start_time) * 1000)

            await websocket.send_text(json.dumps({
                "type": "refined",
                "userId": user_id,
                "en": en_fast or jp_text,   # same for now, LLM will improve this
                "suggestions": [
                    {"jp": "そうですね", "romaji": "sou desu ne", "en": "That's right"},
                    {"jp": "面白い！", "romaji": "omoshiroi!", "en": "Interesting!"},
                    {"jp": "もう一回言って", "romaji": "mou ikkai itte", "en": "Say that again"},
                ],
                "translationSource": "llm",
                "latencyMs": total_latency,
            }))

            log.info(f"[{user_id}] refined packet sent in {total_latency}ms")

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


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
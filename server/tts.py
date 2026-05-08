"""
server/tts.py — Microsoft Edge TTS synthesis (edge-tts)

POST /tts  { "text": "日本語テキスト" }
           → audio/mpeg bytes (MP3)

No GPU required. No model download. Uses Microsoft Edge TTS service.
Install: pip install edge-tts

Environment variables:
  TTS_VOICE = "ja-JP-NanamiNeural"  (default — natural Japanese female voice)
              Other JP options: ja-JP-KeitaNeural (male)
"""

import asyncio
import logging
import os

log = logging.getLogger("miwa.tts")

TTS_VOICE    = os.getenv("TTS_VOICE", "ja-JP-NanamiNeural")
MAX_TEXT_LEN = 200

# Cache availability check result
_edge_available: bool | None = None


def _check_edge_tts() -> bool:
    global _edge_available
    if _edge_available is not None:
        return _edge_available
    try:
        import edge_tts  # noqa: F401
        _edge_available = True
        log.info("edge-tts available ✓")
    except ImportError:
        log.warning("edge-tts not installed — tts disabled. Run: pip install edge-tts")
        _edge_available = False
    return _edge_available


async def _synthesize_async(text: str) -> bytes | None:
    """Async edge-tts synthesis — returns raw MP3 bytes."""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            log.warning("edge-tts returned no audio chunks")
            return None
        result = b"".join(chunks)
        log.info(f"TTS synthesized {len(text)} chars → {len(result)} bytes MP3")
        return result
    except Exception as e:
        log.error(f"edge-tts synthesis failed: {e}")
        return None


def synthesize(text: str) -> bytes | None:
    """
    Synthesize Japanese text to MP3 audio bytes.

    Blocking wrapper — safe to call from asyncio.run_in_executor().
    Returns MP3 bytes, or None if edge-tts is unavailable.
    """
    if not text or not isinstance(text, str):
        return None
    text = text.strip()[:MAX_TEXT_LEN]
    if not text:
        return None
    if not _check_edge_tts():
        return None
    try:
        return asyncio.run(_synthesize_async(text))
    except Exception as e:
        log.error(f"TTS synthesize error: {e}")
        return None


async def synthesize_stream(text: str):
    """
    Async generator — yields MP3 chunks as they arrive from edge-tts.

    Use with FastAPI StreamingResponse so Discord playback starts on the first
    chunk (~300 ms) rather than after the full audio is buffered (~1-2 s).
    """
    if not _check_edge_tts():
        return
    text = (text or "").strip()[:MAX_TEXT_LEN]
    if not text:
        return
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    except Exception as e:
        log.error(f"TTS stream error: {e}")
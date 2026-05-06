"""
server/tts.py — XTTS v2 text-to-speech synthesis

POST /tts  { "text": "日本語テキスト" }
           → audio/wav bytes

Environment variables:
  TTS_DEVICE    = "cuda" | "cpu"        (default: cpu)
  TTS_MODEL     = "tts_models/ja/..."   (default: XTTS v2)
  TTS_SPEAKER   = "Claribel Dervla"     (XTTS speaker voice)
"""

import logging
import os

log = logging.getLogger("miwa.tts")

TTS_DEVICE  = os.getenv("TTS_DEVICE", "cpu")
TTS_MODEL   = os.getenv("TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
TTS_SPEAKER = os.getenv("TTS_SPEAKER", "Claribel Dervla")

MAX_TEXT_LEN = 200  # XTTS works best under 200 chars

# ── Lazy-load TTS ─────────────────────────────────────────────────────────────
_tts = None


def _load() -> bool:
    global _tts
    if _tts is not None:
        return True
    try:
        from TTS.api import TTS as CoquiTTS
        log.info(f"Loading XTTS v2 model on {TTS_DEVICE}...")
        _tts = CoquiTTS(TTS_MODEL).to(TTS_DEVICE)
        log.info("XTTS v2 loaded ✓")
        return True
    except ImportError:
        log.warning("TTS package not installed — tts disabled")
        return False
    except Exception as e:
        log.error(f"TTS load failed: {e}")
        return False


def synthesize(text: str) -> bytes | None:
    """
    Synthesize Japanese text to WAV audio bytes.

    Args:
        text: Japanese text (max 200 chars)

    Returns:
        Raw WAV bytes, or None if TTS is unavailable.
    """
    # Validate input
    if not text or not isinstance(text, str):
        return None

    # Strip and cap length — XTTS degrades on very long inputs
    text = text.strip()[:MAX_TEXT_LEN]
    if not text:
        return None

    if not _load():
        return None

    try:
        import io
        import wave
        import numpy as np

        # Synthesize to numpy array
        wav_array = _tts.tts(
            text=text,
            speaker=TTS_SPEAKER,
            language="ja",
        )

        # Convert numpy float32 → WAV bytes
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)       # 16-bit
            wf.setframerate(22050)   # XTTS native sample rate
            samples = (np.array(wav_array) * 32767).astype(np.int16)
            wf.writeframes(samples.tobytes())

        wav_bytes = buf.getvalue()
        log.info(f"TTS synthesized {len(text)} chars → {len(wav_bytes)} bytes WAV")
        return wav_bytes

    except Exception as e:
        log.error(f"TTS synthesis failed: {e}")
        return None
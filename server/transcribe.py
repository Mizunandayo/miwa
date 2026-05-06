"""
server/transcribe.py — WhisperX speech-to-text wrapper

Input:  raw PCM bytes (16kHz, mono, int16, little-endian)
Output: { "text": str, "words": [{ "word": str, "start": float, "end": float }] }

Environment variables:
  WHISPERX_DEVICE   = "cuda" | "cpu"   (default: cpu, set to cuda on AMD cloud)
  WHISPERX_MODEL    = "large-v3"        (default: large-v3)
  HF_TOKEN          = "hf_..."          (required for diarization model)
"""

import io
import logging
import os
import struct

log = logging.getLogger("miwa.transcribe")

#--- Config ---
DEVICE       = os.getenv("WHISPERX_DEVICE", "cpu")
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"
MODEL_NAME   = os.getenv("WHISPERX_MODEL", "large-v3")
HF_TOKEN     = os.getenv("HF_TOKEN", "")


#--- Lazy-load WhisperX (not installed locally) ---
_model = None
_align_model = None
_align_meta = None

def _load_model():
    global _model, _align_model, _align_meta
    if _model is not None:
        return True
    try:
        import whisperx
        log.info(f"Loading WhisperX model={MODEL_NAME} device={DEVICE}")
        _model = whisperx.load_model(
            MODEL_NAME,
            DEVICE,
            compute_type=COMPUTE_TYPE,
            language="ja",
        )
        _align_model, _align_meta = whisperx.load_align_model(
            language_code="ja",
            device=DEVICE,
        )
        log.info("WhisperX loaded")
        return True
    except ImportError:
        log.warning("whisperx not installed - using transcribe stub")
        return False
    except Exception as e:
        log.error(f"WhisperX load failed: {e}")
        return False
    

def _pcm_to_float32(pcm_bytes: bytes) -> "np.ndarray":
    """Convert raw int16 PCM bytes to float32 numpy array (range -1.0 to 1.0)"""
    import numpy as np
    num_samples = len(pcm_bytes) // 2
    samples = struct.unpack(f"<{num_samples}h", pcm_bytes[:num_samples * 2])
    arr = np.array(samples, dtype=np.float32) / 32768.0
    return arr


def transcribe(pcm_bytes: bytes) -> dict:
    """
    Transcribe PCM audio to Japanese text with word timestamps.

    Args:
        pcm_bytes: Raw 16kHz mono int16 PCM audio bytes

    Returns:
        {
            "text": "おはようございます",
            "words": [
                {"word": "おはよう", "start": 0.0, "end": 0.5},
                {"word": "ございます", "start": 0.5, "end": 1.2},
            ]
        }
    """
    # Sanity check
    if not pcm_bytes or len(pcm_bytes) < 3200:  # < 0.1s at 16kHz int16
        log.warning("Audio too short — skipping transcription")
        return {"text": "", "words": []}

    # Cap at 30s of audio (30 * 16000 * 2 bytes)
    MAX_BYTES = 30 * 16_000 * 2
    if len(pcm_bytes) > MAX_BYTES:
        log.warning(f"Audio truncated from {len(pcm_bytes)} to {MAX_BYTES} bytes")
        pcm_bytes = pcm_bytes[:MAX_BYTES]

    # Try real WhisperX
    if _load_model():
        try:
            import whisperx
            import numpy as np

            audio = _pcm_to_float32(pcm_bytes)

            # Transcribe
            result = _model.transcribe(audio, batch_size=16, language="ja")

            if not result.get("segments"):
                return {"text": "", "words": []}

            # Align for word timestamps
            aligned = whisperx.align(
                result["segments"],
                _align_model,
                _align_meta,
                audio,
                DEVICE,
                return_char_alignments=False,
            )

            # Extract text
            full_text = " ".join(
                seg.get("text", "").strip()
                for seg in aligned.get("segments", [])
            ).strip()

            # Extract word timestamps
            words = []
            for seg in aligned.get("segments", []):
                for w in seg.get("words", []):
                    word = w.get("word", "").strip()
                    if word:
                        words.append({
                            "word": word,
                            "start": round(w.get("start", 0.0), 3),
                            "end":   round(w.get("end",   0.0), 3),
                        })

            # ── Hallucination filter ──────────────────────────────────────────
            HALLUCINATION_SUBSTRINGS = [
                "ご視聴ありがとう", "チャンネル登録", "字幕は自動生成",
                "ご視聴いただき", "高評価", "チャンネル登",
            ]
            HALLUCINATION_EXACT = {
                "おやすみなさい", "ありがとうございました", "ありがとうございます",
                "よろしくお願いします", "よろしくお願いいたします", "字幕",
            }
            stripped = full_text.strip()
            if stripped in HALLUCINATION_EXACT or any(h in stripped for h in HALLUCINATION_SUBSTRINGS):
                log.warning(f"Hallucination filtered: {full_text!r}")
                return {"text": "", "words": []}

            log.info(f"Transcribed: '{full_text}' ({len(words)} words)")
            return {"text": full_text, "words": words}

        except Exception as e:
            log.error(f"WhisperX transcription failed: {e}")
            # Fall through to stub

    # ── Stub fallback ─────────────────────────────────────────────────────────
    log.info(f"transcribe_stub: {len(pcm_bytes)} bytes → stub response")
    stub_text = "おはようございます"
    return {
        "text": stub_text,
        "words": [
            {"word": "おはよう",   "start": 0.0, "end": 0.5},
            {"word": "ございます", "start": 0.5, "end": 1.2},
        ],
    }
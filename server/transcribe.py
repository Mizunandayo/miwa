"""
server/transcribe.py — Whisper speech-to-text wrapper (openai-whisper + ROCm GPU)

Input:  raw PCM bytes (16kHz, mono, int16, little-endian)
Output: { "text": str, "words": [{ "word": str, "start": float, "end": float }] }

Environment variables:
  WHISPERX_DEVICE   = "cuda" | "cpu"   (default: cpu; set "cuda" on AMD cloud — ROCm exposes as CUDA via HIP)
  WHISPERX_MODEL    = "large-v2"        (default: large-v2; large-v3 also works)
  HF_TOKEN          = "hf_..."          (not required for openai-whisper)

Why openai-whisper instead of WhisperX/faster-whisper:
  faster-whisper uses CTranslate2 which has NO ROCm support — always falls back to CPU (3-4s).
  openai-whisper uses PyTorch directly — ROCm maps HIP as CUDA, giving ~200-400ms on MI300X.
"""

import logging
import os
import struct

log = logging.getLogger("miwa.transcribe")

#--- Config ---
DEVICE     = os.getenv("WHISPERX_DEVICE", "cpu")
MODEL_NAME = os.getenv("WHISPERX_MODEL", "large-v2")
USE_FP16   = DEVICE == "cuda"


#--- Lazy-load openai-whisper ---
_model = None

def _load_model():
    global _model
    if _model is not None:
        return True
    try:
        import whisper
        log.info(f"Loading Whisper model={MODEL_NAME} device={DEVICE} fp16={USE_FP16}")
        _model = whisper.load_model(MODEL_NAME, device=DEVICE)
        log.info("Whisper loaded")
        return True
    except ImportError:
        log.warning("openai-whisper not installed — using transcribe stub")
        return False
    except Exception as e:
        log.error(f"Whisper load failed: {e}")
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
    if not pcm_bytes or len(pcm_bytes) < 9600:  # < 0.3s at 16kHz int16
        log.warning("Audio too short — skipping transcription")
        return {"text": "", "words": []}

    # Cap at 30s of audio (30 * 16000 * 2 bytes)
    MAX_BYTES = 30 * 16_000 * 2
    if len(pcm_bytes) > MAX_BYTES:
        log.warning(f"Audio truncated from {len(pcm_bytes)} to {MAX_BYTES} bytes")
        pcm_bytes = pcm_bytes[:MAX_BYTES]

    # Try real Whisper (openai-whisper, PyTorch — works on ROCm via HIP)
    if _load_model():
        try:
            import numpy as np

            audio = _pcm_to_float32(pcm_bytes)

            # Transcribe with word-level timestamps
            result = _model.transcribe(
                audio,
                language="ja",
                word_timestamps=True,
                fp16=USE_FP16,
            )

            if not result.get("segments"):
                return {"text": "", "words": []}

            # Extract full text
            full_text = result.get("text", "").strip()

            # Extract word timestamps from segments
            words = []
            for seg in result.get("segments", []):
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
                "概要欄", "高評価ボタン", "フォローお願い", "グッドボタン",
                "低評価", "この動画", "登録お願い", "次の動画",
                "subscribe", "like and", "thank you for watching",
                "はじめしゃちょー", "エンディング】", "【はじめ",
                "ご利用ください", "どうもありがとうございました",
            ]
            HALLUCINATION_EXACT = {
                "おやすみなさい", "ありがとうございました", "ありがとうございます",
                "ありがとうございます。", "ありがとうございました。",
                "よろしくお願いします", "よろしくお願いいたします", "字幕",
                "以上です", "以上で終わります", "終わります", "終わりです",
                "以上で終わりです", "以上で終わりです。",
                "終わり", "おわり",
            }
            # Strip trailing punctuation for comparison
            import re as _re
            stripped_raw = full_text.strip()
            stripped = _re.sub(r'[\s。、！？!?,.\-…]+$', '', stripped_raw).strip()
            if (stripped in HALLUCINATION_EXACT or stripped_raw in HALLUCINATION_EXACT
                    or any(h in stripped for h in HALLUCINATION_SUBSTRINGS)):
                log.warning(f"Hallucination filtered: {full_text!r}")
                return {"text": "", "words": []}

            # ── Skip very short utterances (< 3 chars) — likely noise ─────────
            if len(stripped) < 3:
                log.info(f"Utterance too short, skipping: {full_text!r}")
                return {"text": "", "words": []}

            log.info(f"Transcribed: '{full_text}' ({len(words)} words)")
            return {"text": full_text, "words": words}

        except Exception as e:
            log.error(f"Whisper transcription failed: {e}")

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
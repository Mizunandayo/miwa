"""
server/memory.py — Per-speaker vector memory via Qdrant

Stores each transcribed utterance as a vector so CrewAI suggest.py
can retrieve relevant context per speaker.

Environment variables:
  QDRANT_URL     = "http://localhost:6333"   (default)
  EMBED_MODEL    = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

Collection: miwa_memory
Vector size: 384 (MiniLM-L12)
"""

import logging
import os
import time
import uuid

log = logging.getLogger("miwa.memory")

QDRANT_URL  = os.getenv("QDRANT_URL", "http://localhost:6333")
EMBED_MODEL = os.getenv(
    "EMBED_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
COLLECTION  = "miwa_memory"
VECTOR_SIZE = 384
TOP_K       = 5  # How many memories to retrieve per query

# ── Lazy-load heavy deps ──────────────────────────────────────────────────────
_qdrant  = None
_encoder = None


def _load() -> bool:
    global _qdrant, _encoder
    if _qdrant is not None:
        return True
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams
        from sentence_transformers import SentenceTransformer

        _encoder = SentenceTransformer(EMBED_MODEL)
        _qdrant  = QdrantClient(url=QDRANT_URL, timeout=3)

        # Create collection if it doesn't exist
        existing = [c.name for c in _qdrant.get_collections().collections]
        if COLLECTION not in existing:
            _qdrant.create_collection(
                collection_name=COLLECTION,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE,
                    distance=Distance.COSINE,
                ),
            )
            log.info(f"Created Qdrant collection: {COLLECTION}")

        log.info("Qdrant + SentenceTransformer loaded ✓")
        return True

    except ImportError:
        log.warning("qdrant-client or sentence-transformers not installed — memory disabled")
        return False
    except Exception as e:
        log.warning(f"Qdrant unavailable ({e}) — memory disabled")
        return False


def _embed(text: str) -> list[float]:
    """Encode text into a vector."""
    vec = _encoder.encode(text, normalize_embeddings=True)
    return vec.tolist()


def store(user_id: str, jp: str, en: str, style: str = "casual") -> bool:
    """
    Store a speaker utterance in vector memory.

    Args:
        user_id: Discord user ID (used as filter)
        jp:      Japanese text
        en:      English translation
        style:   Translation style used

    Returns True if stored, False if memory is disabled.
    """
    # Validate inputs — never trust caller
    if not user_id or not isinstance(user_id, str) or len(user_id) > 64:
        return False
    if not jp or len(jp) > 500:
        return False

    if not _load():
        return False

    try:
        from qdrant_client.models import PointStruct

        vector = _embed(jp)
        point  = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "userId":    user_id,
                "jp":        jp[:500],
                "en":        (en or "")[:500],
                "style":     style,
                "timestamp": time.time(),
            },
        )
        _qdrant.upsert(collection_name=COLLECTION, points=[point])
        log.debug(f"Stored memory for {user_id}: '{jp[:40]}'")
        return True

    except Exception as e:
        log.error(f"Memory store failed: {e}")
        return False


def recall(user_id: str, query: str, top_k: int = TOP_K) -> list[dict]:
    """
    Retrieve the most relevant past utterances for a speaker.

    Args:
        user_id: Discord user ID to filter by
        query:   Current JP utterance to find similar past context
        top_k:   How many memories to return

    Returns list of { jp, en, score, timestamp }
    """
    if not user_id or not query:
        return []
    if not _load():
        return []

    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        vector = _embed(query)
        results = _qdrant.query_points(
            collection_name=COLLECTION,
            query=vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="userId",
                        match=MatchValue(value=user_id),
                    )
                ]
            ),
            limit=min(top_k, 10),  # cap at 10 regardless of caller
            with_payload=True,
        ).points

        memories = []
        for hit in results:
            payload = hit.payload or {}
            memories.append({
                "jp":        payload.get("jp", ""),
                "en":        payload.get("en", ""),
                "score":     round(hit.score, 4),
                "timestamp": payload.get("timestamp", 0),
            })

        log.debug(f"Recalled {len(memories)} memories for {user_id}")
        return memories

    except Exception as e:
        log.error(f"Memory recall failed: {e}")
        return []
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

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%/(levelname)s] %(message)s",
)
log = logging.getLogger("miwa-server")

# --- Config ---
GOOGLE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
MAX_AUDIO_BYTE = 2 * 1024 * 1024 # 2MB limit - prevents memory attacks
MAX_TEXT_LENGTH = 500            # Characters

if not GOOGLE_API_KEY:
    log.warning("Google Translate API key not found. Translation will not work.")


# --- pykakasi setup ---
kks = pykakasi.kakasi()

# --- App ---
app = FastAPI(title="Miwa Server", version="0.1.0")

# Allow WebSocket from localhost only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Track active connections (userId -> WebSocket)
active_connections: dict[str, WebSocket] = {}

# --- Helper functions ---
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






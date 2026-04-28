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
GOOGLE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY")
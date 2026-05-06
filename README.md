# Miwa 美話 — Real-Time Discord Voice Translation Overlay

> **Beautiful Conversation** — Break the language barrier in Discord voice calls, live.

Miwa is a transparent always-on-top desktop overlay that listens to your Discord voice channel, transcribes each speaker's Japanese audio separately, and shows you the translation + romaji + AI-generated reply suggestions — all within 800ms.

Built for the **AMD Developer Hackathon 2026** (lablab.ai) — Track 1: AI Agents & Agentic Workflows.  
Powered by **AMD MI300X** · **Llama 3.3 70B** · **WhisperX** · **CrewAI** · **XTTS v2**

---

## What It Does

When your Japanese-speaking friends talk in a Discord voice channel:

1. **Captures** per-speaker Opus audio (not the mixed stream)
2. **Transcribes** with WhisperX on AMD MI300X — word-level timestamps
3. **Shows** Google Translate result instantly (~100ms) — karaoke word highlight
4. **Refines** with Llama 3.3 70B to your chosen style (Formal / Neutral / Casual / Gaming)
5. **Generates** romaji pronunciation below every line
6. **Suggests** 3 contextual AI reply options via CrewAI multi-agent pipeline
7. **Delivers** replies 3 ways:
   - 🔊 **Bot Speaks** — XTTS v2 synthesises your reply into the voice channel
   - 💬 **Bot Sends** — bot types it in the text sidechat
   - 🎤 **I'll Speak** — fullscreen romaji popup so you can say it yourself

Also captures **typed messages** in the voice channel's text sidechat — same card layout, 💬 icon vs 🎙️ mic.

---

## Demo

> Demo video coming — recorded against local stub server (cloud GPU reconnects Day 5)

| Feature | Preview |
|---|---|
| Speaker cards with karaoke highlight | *(screenshot)* |
| Suggestion cards with delivery buttons | *(screenshot)* |
| Fullscreen romaji popup | *(screenshot)* |
| Quick reply box (type EN → live JP) | *(screenshot)* |

---

## Architecture

```
Discord Voice Channel
  └─ discord.js v14 (local Node.js)
       ├─ per-user Opus → PCM (prism-media)
       └─ SSH tunnel WebSocket → AMD Cloud FastAPI (port 8765)
            ├─ WhisperX  ── PCM → JP text + word timestamps
            ├─ Google Translate API  ── fast first-pass EN (shown immediately)
            ├─ vLLM / Llama 3.3 70B  ── style-refined translation
            ├─ pykakasi  ── romaji generation
            ├─ Qdrant  ── vector memory per speaker (Discord user ID)
            ├─ CrewAI  ── multi-agent suggestion pipeline (Track 1)
            └─ XTTS v2  ── TTS audio for Bot Speaks
                 └─ JSON packets → WebSocket → Tauri Rust backend
                      └─ React 19 overlay (always-on-top, transparent)
```

### Two-Pass Translation
1. Google Translate result sent as `type: "fast"` — shown in ~100ms  
2. vLLM refined result sent as `type: "refined"` — updates card in ~700ms  

Users see a translation immediately; it upgrades silently to the LLM version.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop overlay | Tauri v2 + React 19 + Vite |
| State | Jotai atoms |
| Animation | Framer Motion |
| Styling | Tailwind CSS v4 |
| Discord audio | discord.js v14 + @discordjs/voice + prism-media |
| Local DB | better-sqlite3 (WAL, avatar cache, phrasebook) |
| GPU server | FastAPI WebSocket (Python) |
| Transcription | WhisperX |
| LLM inference | vLLM 0.17.1 — Llama 3.3 70B Instruct |
| GPU | AMD MI300X — 192GB VRAM, ROCm 7.2 |
| Agent pipeline | CrewAI |
| Vector memory | Qdrant |
| TTS | XTTS v2 |
| Romaji | pykakasi |
| Translation | Google Cloud Translation API |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Rust 1.70+ (for Tauri)
- Discord bot token with `bot` + `applications.commands` scopes, and **Voice** permissions

### 1 — Clone & install

```bash
git clone https://github.com/Mizunandayo/miwa.git
cd miwa
npm install
```

### 2 — Environment

Copy `.env.example` to `.env` and fill in your keys:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
GOOGLE_TRANSLATE_API_KEY=your_key
HF_TOKEN=your_huggingface_token
AMD_SERVER_WS_URL=ws://localhost:8765
UI_WS_PORT=8766
SERVER_WS_PORT=8765
DEFAULT_STYLE=casual
```

### 3 — Python server (local stub)

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py
# → ws://127.0.0.1:8765
```

### 4 — Discord bot

```bash
node bot/index.js
# → UI WS server on ws://127.0.0.1:8766
```

### 5 — Overlay

```bash
npm run tauri dev
```

Type `!join` in any Discord text channel to have the bot join your voice channel.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` / `2` / `3` | botSends suggestion 1/2/3 from most recent speaker |
| `Ctrl+1` – `Ctrl+9` | Send saved phrasebook entry |
| `Escape` | Close romaji popup |
| Double-click header | Snap overlay to nearest screen corner |

---

## AMD Cloud Setup (production)

```bash
# SSH in
ssh -i "$HOME/.ssh/miwa_amd" root@<instance-ip>

# Enter ROCm container
docker exec -it rocm /bin/bash

# Start vLLM (background)
nohup vllm serve /app/models/llama3.3-70b \
  --host 0.0.0.0 --port 8000 \
  --max-model-len 8192 \
  > /app/vllm.log 2>&1 &

# SSH tunnel (local machine)
ssh -i "$HOME/.ssh/miwa_amd" -N -L 8765:localhost:8765 root@<instance-ip>
```

Model: Llama 3.3 70B Instruct at `/app/models/llama3.3-70b/` (263 GB, FP16, full quality on MI300X 192GB VRAM).

---

## Project Structure

```
miwa/
├── bot/
│   ├── index.js       # Discord voice capture, WebSocket bridge
│   ├── db.js          # SQLite — avatar cache, phrasebook
│   └── tts.js         # Bot Speaks / Bot Sends delivery (XTTS v2)
├── server/
│   ├── main.py        # FastAPI WebSocket server (AMD cloud)
│   ├── transcribe.py  # WhisperX wrapper
│   ├── translate.py   # Google Translate + vLLM
│   ├── suggest.py     # CrewAI suggestion pipeline
│   ├── romaji.py      # pykakasi
│   ├── memory.py      # Qdrant vector store
│   └── tts.py         # XTTS v2
├── src/
│   ├── App.tsx
│   ├── store/atoms.ts
│   └── components/
│       ├── SpeakerCard.tsx
│       ├── KaraokeText.tsx
│       ├── SuggestionCard.tsx
│       ├── RomajiPopup.tsx
│       ├── QuickReplyBox.tsx
│       ├── QuickReactions.tsx
│       ├── Phrasebook.tsx
│       ├── StatsPanel.tsx
│       ├── CallInfoStrip.tsx
│       └── Header.tsx
└── src-tauri/         # Tauri Rust backend
```

---

## Hackathon

- **Event:** AMD Developer Hackathon 2026 — lablab.ai
- **Track:** Track 1 — AI Agents & Agentic Workflows
- **Deadline:** May 11, 2026 — 3:00 AM PHT
- **Developer:** Francis Daniel (GitHub: Mizunandayo)

Prize tracks targeted:
- Track 1: AI Agents (CrewAI multi-agent suggestion pipeline)
- Qwen partner prize (Qwen2.5-72B alternate model path)
- HuggingFace Space likes
- Ship It social challenge

---

## License

MIT

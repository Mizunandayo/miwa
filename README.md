# Miwa 美話 — Real-Time Japanese Discord Voice Translation Overlay

> Beautiful Conversation — break language barriers in Discord voice calls, live.

Miwa is a transparent, always-on-top desktop overlay that captures per-speaker Discord voice, transcribes Japanese speech, shows instant translation + romaji, and generates contextual AI replies for live conversations.

Built for the **AMD Developer Hackathon 2026** (lablab.ai), **Track 1: AI Agents & Agentic Workflows**.

## Live Links

- Demo video: https://youtu.be/jZzCQzYThZE
- Web walkthrough: https://mizunandayo.github.io/miwa/
- Repository: https://github.com/Mizunandayo/miwa

## Current Project State

- End-to-end pipeline is running in real Discord calls
- Two-pass translation is active:
     1. Fast packet first (Google Translate)
     2. Refined packet second (vLLM + Llama 3.3 70B)
- Suggestions are deferred so translation appears first
- TTS pre-synthesis cache is enabled (low perceived delay on Bot Speaks)
- Per-member pipeline toggle is enabled (exclude non-target speakers)
- UI includes quick reactions, phrasebook shortcuts, romaji popup, stats panel, and call member strip

## What Miwa Does

When someone speaks Japanese in a Discord voice channel, Miwa:

1. Captures per-speaker Opus audio (not mixed audio)
2. Transcribes with **openai-whisper** (word-level timestamps)
3. Sends fast translation immediately via Google Translate
4. Sends refined style-aware translation via **Llama 3.3 70B** on vLLM
5. Generates romaji for pronunciation support
6. Generates 3 contextual replies via multi-agent flow
7. Delivers replies via:
      - Bot Speaks (edge-tts)
      - Bot Sends (channel text chat)
      - I'll Speak (fullscreen romaji)

Also captures typed voice-channel sidechat messages into the same card workflow.

## Architecture

```
Discord Voice Channel
     -> discord.js (@discordjs/voice + prism-media)
     -> per-speaker Opus/PCM streams
     -> WebSocket to FastAPI server (port 8765)
           -> openai-whisper transcription
           -> Google Translate fast pass
           -> vLLM (Llama 3.3 70B) refine + suggestions
           -> pykakasi romaji
           -> Qdrant speaker memory
           -> edge-tts synthesis
     -> JSON packets to Tauri/React overlay
```

### Latency Strategy (Two-Pass)

- `fast` packet appears first for immediate readability
- `refined` packet upgrades text quality/style after
- Result: low perceived latency while preserving LLM quality

## Tech Stack

| Layer | Technology |
|---|---|
| Core Languages | TypeScript, JavaScript, Python, HTML, CSS |
| Desktop App | Tauri v2, React 19, Vite |
| State / UI | Jotai, Framer Motion |
| Discord | discord.js v14, @discordjs/voice, prism-media |
| Local Storage | better-sqlite3 (WAL) |
| Server | FastAPI (WebSocket) |
| Transcription | openai-whisper |
| Translation | Google Cloud Translation API + vLLM refinement |
| LLM | Llama 3.3 70B Instruct (vLLM 0.17.x) |
| Agentic Suggestions | CrewAI-style Analyst -> Strategist -> Writer flow |
| Memory | Qdrant + sentence-transformers |
| TTS | edge-tts |
| Romaji | pykakasi |
| Infra | AMD MI300X (ROCm), Docker, SSH tunnel |

## Quick Start (Local)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Rust (for Tauri)
- Discord bot token with voice permissions

### 1) Install dependencies

```bash
git clone https://github.com/Mizunandayo/miwa.git
cd miwa
npm install
```

### 2) Configure environment

Create `.env` in project root:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
GOOGLE_TRANSLATE_API_KEY=
HF_TOKEN=
AMD_SERVER_WS_URL=ws://localhost:8765
UI_WS_PORT=8766
SERVER_WS_PORT=8765
DEFAULT_STYLE=casual
```

### 3) Start Python server

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 4) Start Discord bot

```bash
cd ..
node bot/index.js
```

### 5) Start overlay

```bash
npm run tauri dev
```

## Production Notes (AMD Cloud)

Inside `rocm` container, vLLM should run with VRAM headroom for Whisper:

```bash
nohup vllm serve /app/models/llama3.3-70b \
     --host 0.0.0.0 \
     --port 8000 \
     --max-model-len 8192 \
     --gpu-memory-utilization 0.80 \
     > /app/vllm.log 2>&1 &
```

Local tunnel example:

```bash
ssh -i "$HOME/.ssh/miwa_amd" -N -L 8765:172.17.0.2:8765 root@<amd-instance-ip>
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` / `2` / `3` | Send suggestion #1 / #2 / #3 |
| `Ctrl+1` to `Ctrl+9` | Send saved phrasebook slot |
| `Esc` | Close romaji popup |
| Double-click header | Snap window to nearest corner |

## Project Structure

```
miwa/
├── bot/
│   ├── index.js
│   ├── db.js
│   └── tts.js
├── server/
│   ├── main.py
│   ├── transcribe.py
│   ├── suggest.py
│   ├── memory.py
│   ├── tts.py
│   └── requirements.txt
├── src/
├── src-tauri/
├── hf-space/
└── docs/
```

## Hackathon Info

- Event: AMD Developer Hackathon 2026 (lablab.ai)
- Track: Track 1 — AI Agents & Agentic Workflows
- Developer: Francis Daniel (GitHub: Mizunandayo)

## License

MIT

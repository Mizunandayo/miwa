# CLAUDE.md — Miwa Project Depth Details
## AMD Developer Hackathon | May 4–11, 2026

> This file is for AI assistants (Claude, Copilot, etc.) to quickly understand the full project context without reading multiple files.

---

## IDENTITY

- **Project:** Miwa (美話 — "Beautiful Conversation")
- **Developer:** Francis Daniel (GitHub: Mizunandayo, Discord/handle: Mizu)
- **Hackathon:** AMD Developer Hackathon 2026 (lablab.ai)
- **Track:** Track 1 — AI Agents & Agentic Workflows
- **Deadline:** May 11, 2026 — 3:00 AM PHT
- **Repo:** https://github.com/Mizunandayo/miwa

---

## WHAT MIWA DOES

Real-time Discord voice translation overlay. When Japanese-speaking friends talk in a Discord voice call, Miwa:
1. Captures their audio per-speaker (not mixed)
2. Transcribes it (WhisperX on AMD MI300X)
3. Shows Google Translate result instantly (<100ms)
4. LLM refines translation to selected style (Formal/Neutral/Casual/Gaming)
5. Generates romaji pronunciation
6. Shows 3 contextual AI reply suggestions
7. Delivers replies 3 ways: Bot speaks in VC, Bot sends in chat, I'll speak (romaji popup)

Target latency: **<800ms** end-to-end.

---

## CLOUD INFRASTRUCTURE (LIVE)

- **Provider:** AMD Developer Cloud (DigitalOcean-based)
- **Instance:** MI300X x1 — 192GB VRAM, 20 vCPU, 240GB RAM
- **IP:** 165.245.134.220
- **Cost:** $1.99/hr, $100 credit balance
- **SSH Key:** `$HOME\.ssh\miwa_amd` (private), `miwa_amd.pub` (public)
- **SSH Command:** `ssh -i "$HOME\.ssh\miwa_amd" -o StrictHostKeyChecking=no root@165.245.134.220`

### Docker Container (vLLM)
- Container name: `rocm`
- Enter: `docker exec -it rocm /bin/bash`
- vLLM version: 0.17.1
- ROCm version: 7.2.0
- PyTorch: 2.6.0

### Model
- **Llama 3.3 70B Instruct** — fully downloaded
- Path: `/app/models/llama3.3-70b/`
- Size: 263GB on disk
- vLLM serving: `nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &`
- Health check: `curl -s http://localhost:8000/health`
- vLLM log: `tail -f /app/vllm.log`

### Jupyter Token (AMD portal)
- Token: `bXWD3tG0bPtyeY2rOtKWUWa0bUFfQqxueb1YauBQrCzth3b/R`

---

## LOCAL MACHINE

- **OS:** Windows 11
- **Project path:** `C:\Users\trist\Desktop\Programming\miwa`
- **Runtime:** Node.js 18+, npm
- **Framework:** Tauri v2 + React 19 + Vite

### npm packages installed
- `discord.js` v14
- `@discordjs/voice`
- `prism-media`
- `sharp`
- `better-sqlite3`
- `ws`
- `dotenv`
- `framer-motion`
- `jotai`
- `@tailwindcss/vite` v4
- `@tauri-apps/api` v2
- `@tauri-apps/plugin-opener`
- `@tauri-apps/plugin-shell`

### .env file
Located at `C:\Users\trist\Desktop\Programming\miwa\.env`
Required keys:
```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
GOOGLE_TRANSLATE_API_KEY=
HF_TOKEN=
AMD_SERVER_HOST=165.245.134.220
AMD_SERVER_PORT=8000
```

---

## FULL ARCHITECTURE

```
Discord Voice Channel
  → discord.js (local Node.js)
    → per-user Opus audio stream
    → prism-media decodes to PCM
    → SSH tunnel WebSocket → AMD Cloud FastAPI (port 8000)
      → WhisperX: PCM → Japanese text + word timestamps
      → Google Translate API: fast first-pass EN translation (shown immediately)
      → vLLM (Llama 3.3 70B): style-refined translation + 3 suggestions
      → pykakasi: romaji generation
      → Qdrant: vector memory per speaker (keyed by Discord user ID)
      → CrewAI: multi-agent suggestion pipeline
      → XTTS v2: TTS audio for "Hear It" and "Bot Speaks"
    → JSON packets → WebSocket → Tauri Rust backend
      → React UI (speaker cards, suggestion cards, overlay controls)
```

### Two-pass translation strategy
1. Google Translate result sent immediately as `type: "fast"` packet
2. vLLM refined result sent as `type: "refined"` packet to update card
3. User sees translation in ~100ms, refined in ~700ms

---

## FILE STRUCTURE (planned)

```
miwa/
├── bot/
│   ├── index.js          # Discord bot — voice capture, WebSocket client
│   ├── db.js             # SQLite helper — cache avatars, phrasebook
│   └── tts.js            # Bot speaks / Bot sends delivery
├── server/
│   ├── main.py           # FastAPI WebSocket server (runs on AMD cloud)
│   ├── transcribe.py     # WhisperX wrapper
│   ├── translate.py      # Google Translate + vLLM translation
│   ├── suggest.py        # CrewAI suggestion agent pipeline
│   ├── romaji.py         # pykakasi romaji generator
│   ├── memory.py         # Qdrant vector store per speaker
│   └── tts.py            # XTTS v2 synthesis
├── src/
│   ├── App.jsx           # Root component
│   ├── main.jsx          # Entry point
│   ├── store/
│   │   └── atoms.js      # Jotai atoms: speakers, settings, suggestions
│   └── components/
│       ├── SpeakerCard.jsx       # Avatar + name + JP text + romaji + EN
│       ├── KaraokeText.jsx       # Word-by-word highlight animation
│       ├── RomajiLine.jsx        # Romaji display below JP text
│       ├── SuggestionCard.jsx    # 3 suggestion cards with delivery buttons
│       ├── RomajiPopup.jsx       # Fullscreen romaji for "I'll Speak"
│       ├── QuickReplyBox.jsx     # Type EN → live JP translation
│       ├── QuickReactions.jsx    # 草 えー マジ? gg もう一回 待って
│       ├── Header.jsx            # Drag handle, mode buttons, opacity
│       ├── Phrasebook.jsx        # Saved phrases, Ctrl+1-9 hotkeys
│       └── StatsPanel.jsx        # Latency, tokens/sec, GPU memory
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs        # Tauri commands: WebSocket bridge, window control
│   │   └── main.rs
│   └── tauri.conf.json   # Always-on-top, transparent, no decorations
├── .env                  # Secrets (gitignored)
├── CLAUDE.md             # This file
├── MEMORY.md             # Conversation backup
└── MIWA_BLUEPRINT.md     # Full design blueprint
```

---

## TAURI WINDOW CONFIGURATION (target)

```json
{
  "title": "Miwa",
  "width": 420,
  "height": 700,
  "alwaysOnTop": true,
  "transparent": true,
  "decorations": false,
  "resizable": true
}
```

---

## CURRENT BUILD STATUS

| Component | Status |
|---|---|
| AMD MI300X instance | ✅ LIVE — 165.245.134.220 |
| Llama 3.3 70B downloaded | ✅ 263GB at /app/models/llama3.3-70b |
| vLLM serving (background) | ✅ PID 1695, port 8000 |
| PyTorch + ROCm GPU access | ✅ Confirmed |
| Japanese output confirmed | ✅ こんにちは |
| Payment method added | ✅ |
| SSH key configured | ✅ miwa_amd |
| Git repo connected | ✅ github.com/Mizunandayo/miwa |
| Tailwind v4 installed | ✅ @tailwindcss/vite |
| Discord bot code | 🔨 IN PROGRESS — bot/index.js guide complete |
| FastAPI server code | 🔨 IN PROGRESS — server/main.py guide complete |
| React UI components | 🔨 IN PROGRESS — SpeakerCard/Karaoke/Romaji/Header |
| Tauri window config | 🔨 IN PROGRESS — overlay config guide complete |
| WhisperX installed | ❌ NOT STARTED (Day 5 — needs cloud) |
| Qdrant container | ❌ NOT STARTED (Day 5) |
| CrewAI agents | ❌ NOT STARTED (Day 5) |
| XTTS v2 | ❌ NOT STARTED (Day 5) |
| SSH tunnel for WebSocket | ❌ NOT STARTED (Day 5) |

---

## CREDENTIALS (DO NOT COMMIT)

- **HuggingFace token name:** `miwa-overlayamd` (overlaychat-amd) — stored in cloud at `/root/.cache/huggingface/token`
- **Google Translate API key name:** "Miwa API Key" — restricted to Cloud Translation API
- **Discord bot:** token saved in `.env`
- **AMD Jupyter token:** `bXWD3tG0bPtyeY2rOtKWUWa0bUFfQqxueb1YauBQrCzth3b/R`

---

## PRIZE STRATEGY

1. **Track 1: AI Agents & Agentic Workflows** — CrewAI multi-agent pipeline for suggestions
2. **Qwen partner prize** — add Qwen2.5-72B as alternate model path
3. **HuggingFace Space likes prize** — publish web demo Space
4. **Ship It social challenge** — 2 posts tagging @AIatAMD + @lablab

---

## KEY DECISIONS

- **Two-pass translation:** GT first (<100ms) → LLM refinement (~700ms) — feels instant
- **Cloud GPU only** (no local model) — MI300X 192GB runs 70B in full FP16, no quality loss
- **SSH tunnel** — no public ports exposed, all traffic through port 22
- **Tauri not Electron** — 50MB vs 200MB, native always-on-top, Rust security
- **WebSocket not HTTP** — required for real-time word-by-word karaoke highlighting
- **pykakasi not MeCab** — pure Python, no native dependencies, easier cloud install

---

## COMMANDS REFERENCE

### Cloud
```bash
# SSH in
ssh -i "$HOME\.ssh\miwa_amd" -o StrictHostKeyChecking=no root@165.245.134.220

# Enter Docker container
docker exec -it rocm /bin/bash

# Start vLLM background
nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &

# Check vLLM health
curl -s http://localhost:8000/health

# Check vLLM log
tail -f /app/vllm.log

# Test Japanese output
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"/app/models/llama3.3-70b","messages":[{"role":"user","content":"Reply only in Japanese characters: say hello"}],"max_tokens":30}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'])"

# GPU status
rocm-smi

# Disk usage
df -h /
```

### Local
```powershell
# Dev server (Tauri overlay)
npm run tauri dev

# Build .exe
npm run tauri build

# Run Python server (local, activate venv first)
cd server ; .venv\Scripts\activate ; python main.py
# Runs on ws://127.0.0.1:8765

# Run Discord bot
node bot/index.js
# Bot WS server on ws://127.0.0.1:8766 (bot → Tauri UI)

# SSH tunnel for WebSocket (Day 5 — point to AMD cloud)
ssh -i "$HOME\.ssh\miwa_amd" -N -L 8765:localhost:8765 root@<new-ip>
```

### WebSocket Ports
- **8765**: Bot ↔ AMD cloud server (FastAPI) — tunneled via SSH in production
- **8766**: Bot → Tauri React UI (localhost only, never exposed)

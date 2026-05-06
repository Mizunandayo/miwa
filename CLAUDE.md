# CLAUDE.md — Miwa Project Depth Details
## AMD Developer Hackathon | May 4–11, 2026

> This file is for AI assistants (Claude, Copilot, etc.) to quickly understand the full project context without reading multiple files.

---

## ACTUAL DAY PROGRESS (vs. blueprint plan)

| Day | Date | Blueprint Plan | What Was Actually Done |
|---|---|---|---|
| 1 | May 4 | Infrastructure + WebSocket + Discord audio | AMD Cloud provisioned, MI300X verified, Llama 3.3 70B downloaded (263GB), vLLM serving confirmed |
| 2 | May 5 | Translation + profile pictures + multi-speaker UI | server/main.py, bot/index.js, bot/db.js, all React components (App.tsx, Header, SpeakerCard, KaraokeText, RomajiLine, atoms.ts), Tauri config, full design system CSS |
| 3 | May 6 | LLM + Agents + Memory (cloud) | UI polish — QuickReplyBox, SuggestionCard (delivery buttons), RomajiPopup, QuickReactions, Phrasebook (Ctrl+1-9), StatsPanel, CallInfoStrip, resize handle, bug fix: google_translate source hardcode |
| 4 | May 7 | Suggestions + Quick Reply + Full UX | 🔨 In progress — README.md ✅, 1/2/3 key shortcuts ✅, card animation polish (guided), snap-to-corner (guided), hf-space/ ⬜, bot/tts.js ⬜ |
| 5 | May 8 | Polish + .exe build | ⬜ Planned: Recreate AMD cloud, WhisperX, Qdrant, CrewAI, XTTS, SSH tunnel, StatsPanel |
| 6 | May 9 | GitHub + HF Space + Demo Video | ⬜ Planned |
| 7 | May 10 | Final Review + SUBMIT | ⬜ Planned |

**Note:** Cloud (MI300X) was destroyed after Day 1 to stop billing (~$83 remaining). All Day 2–3 work done locally with stub server. Cloud will be recreated Day 5 (May 8).

---

## FULL TASK LIST (by day)

### Day 1 (May 4) — Foundation ✅
- ✅ Git repo initialized + pushed to GitHub
- ✅ Tailwind v4 installed (@tailwindcss/vite)
- ✅ TypeScript strict mode configured (tsconfig.json, @types/react)
- ✅ .gitignore updated, .env.example created
- ✅ AMD MI300X provisioned, SSH key configured (miwa_amd)
- ✅ PyTorch + ROCm GPU access confirmed
- ✅ Japanese output confirmed from Llama 3.3 70B

### Day 2 (May 5) — Core Pipeline ✅
- ✅ main.py — FastAPI WebSocket server on ws://127.0.0.1:8765/ws
- ✅ requirements.txt locked (setuptools<71 fix)
- ✅ db.js — SQLite helper
- ✅ index.js — Discord voice capture, dual WS bridge
- ✅ atoms.ts — Jotai atoms
- ✅ App.tsx — WebSocket bridge, packet routing
- ✅ Header.tsx — drag, opacity, style buttons
- ✅ SpeakerCard.tsx — avatar, JP/romaji/EN, suggestions
- ✅ KaraokeText.tsx — word-by-word highlight
- ✅ RomajiLine.tsx
- ✅ Tauri window config — always-on-top, transparent, no decorations
- ✅ opusscript installed (Opus decoder fallback)
- ✅ .env bug fixed (/ws path missing)
- ✅ Server idle timeout bug fixed (30s disconnect removed)
- ✅ Full pipeline confirmed working end-to-end (real Discord avatars, latency <800ms)

### Day 3 (May 6) — Quick Reply + Polish ✅
- ✅ QuickReplyBox.tsx — debounced auto-translate (500ms), style-aware
- ✅ quickReplyResultAtom, quickReplyLoadingAtom atoms added
- ✅ Server quick_reply handler — EN→JP + romaji
- ✅ google_translate source bug fixed (was hardcoded "source": "ja")
- ✅ Suggestion chips — collapse/expand, EN text below JP, refresh from pool of 12
- ✅ Vertical resize handle (drag bottom edge, LogicalSize API)
- ✅ CallInfoStrip.tsx — guild icon, member avatars, collapsible
- ✅ callInfoAtom + CallInfo/CallMember types
- ✅ broadcastCallInfo() in bot — async, fetches guild icon + all VC member avatars
- ✅ SuggestionCard.tsx — delivery buttons (Bot Speaks stub / Bot Sends / I'll Speak), save to phrasebook 📌
- ✅ RomajiPopup.tsx — fullscreen romaji overlay, Escape + click-outside to close
- ✅ QuickReactions.tsx — 草 えー マジ? gg もう一回 待って (one-click botSends)
- ✅ Phrasebook.tsx — saved phrases, Ctrl+1-9 hotkeys, collapsible
- ✅ StatsPanel.tsx — latency color-coded (green/amber/red), WS status
- ✅ romajiPopupAtom, phrasebookAtom, phrasebookOpenAtom added to atoms.ts
- ✅ bot/index.js — savePhrase, deletePhrase, botSpeaks stub handlers; phrasebook sent on UI connect
- ✅ App.tsx — phrasebook packet handler, QuickReactions + Phrasebook + StatsPanel + RomajiPopup in JSX
- ✅ Git commit + push Day 3 work

### Day 4 (May 7) — UI Polish + Demo Prep
- ✅ Animate speaker cards in/out (Framer Motion spring polish) — guided (user implementing)
- ✅ Window snap-to-corner (double-click header) — guided (user implementing)
- ✅ Number key shortcuts 1/2/3 for suggestion delivery — guided + placement confirmed
- ✅ README.md — full professional README written
- ⬜ bot/tts.js — Bot Speaks stub file structure (for Day 5 XTTS v2 wiring)
- ⬜ hf-space/ — create subfolder + README.md (HF front matter) + index.html (demo page)
- ⬜ Record demo video footage (local pipeline — no cloud needed)
- ⬜ Git commit + push Day 4

### Day 5 (May 8) — AMD Cloud Reconnect ☁️
- ⬜ Recreate AMD MI300X droplet ($1.99/hr, ~$83 credit)
- ⬜ Re-download Llama 3.3 70B (263GB) to /app/models/llama3.3-70b/
- ⬜ Start vLLM background server (nohup vllm serve ...)
- ⬜ SSH tunnel WebSocket (ssh -N -L 8765:localhost:8765 root@<new-ip>)
- ⬜ Install WhisperX in ROCm container
- ⬜ Replace transcribe_stub() with real WhisperX call
- ⬜ Install Qdrant container, wire memory.py
- ⬜ Install CrewAI, build suggest.py multi-agent pipeline
- ⬜ Install XTTS v2, wire server/tts.py + bot/tts.js
- ⬜ Real vLLM style differentiation (Formal/Neutral/Casual/Gaming)

### Day 6 (May 9) — Integration + Testing
- ⬜ End-to-end test with real voice + cloud GPU
- ⬜ Latency profiling (target: <800ms total)
- ⬜ Qwen2.5-72B alternate model path (Qwen partner prize)
- ⬜ Fix any bugs found in full pipeline

### Day 7 (May 10) — Submission
- ⬜ Publish HuggingFace Space web demo (Space likes prize)
- ⬜ 2 social posts tagging @AIatAMD + @lablab (Ship It challenge)
- ⬜ Final git push
- ⬜ Submit to lablab.ai before May 11, 3:00 AM PHT

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
8. Also captures typed messages in the voice channel's text sidechat — same card layout, 💬 icon vs 🎙️ mic icon

Target latency: **<800ms** end-to-end.

---

## CLOUD INFRASTRUCTURE (DESTROYED — recreate Day 5)

- **Provider:** AMD Developer Cloud (DigitalOcean-based)
- **Instance:** MI300X x1 — 192GB VRAM, 20 vCPU, 240GB RAM
- **IP:** ❌ DESTROYED (was 165.245.134.220) — new IP will differ when recreated
- **Cost:** $1.99/hr, ~$83 credit balance remaining
- **SSH Key:** `$HOME\.ssh\miwa_amd` (private), `miwa_amd.pub` (public) — still exists locally
- **SSH Command:** `ssh -i "$HOME\.ssh\miwa_amd" -o StrictHostKeyChecking=no root@<new-ip>`
- **Recreate on:** Day 5 (May 8) — only pay for GPU when cloud features needed

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
- `@fontsource-variable/geist`
- `@fontsource-variable/geist-mono`
- `typescript` (devDep)
- `@types/react` (devDep)
- `@types/react-dom` (devDep)
- `@types/node` (devDep)

### Language decisions
- **React frontend (`src/`):** TypeScript (`.tsx`/`.ts`) — strict mode enabled
- **Discord bot (`bot/`):** JavaScript (`.js`) — plain Node.js ESM
- **Python server (`server/`):** Python — different runtime, TypeScript N/A

### .env file
Located at `C:\Users\trist\Desktop\Programming\miwa\.env`
Required keys:
```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
GOOGLE_TRANSLATE_API_KEY=
HF_TOKEN=
AMD_SERVER_WS_URL=ws://localhost:8765
UI_WS_PORT=8766
SERVER_WS_PORT=8765
DEFAULT_STYLE=casual
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
│   ├── App.tsx           # Root component (TypeScript)
│   ├── main.tsx          # Entry point (TypeScript)
│   ├── store/
│   │   └── atoms.ts      # Jotai atoms: speakers, settings, suggestions
│   └── components/
│       ├── SpeakerCard.tsx       # Avatar + name + JP text + romaji + EN
│       ├── KaraokeText.tsx       # Word-by-word highlight animation
│       ├── RomajiLine.tsx        # Romaji display below JP text
│       ├── SuggestionCard.tsx    # 3 suggestion cards with delivery buttons
│       ├── RomajiPopup.tsx       # Fullscreen romaji for "I'll Speak"
│       ├── QuickReplyBox.tsx     # Type EN → live JP translation
│       ├── QuickReactions.tsx    # 草 えー マジ? gg もう一回 待って
│       ├── Header.tsx            # Drag handle, mode buttons, opacity
│       ├── Phrasebook.tsx        # Saved phrases, Ctrl+1-9 hotkeys
│       └── StatsPanel.tsx        # Latency, tokens/sec, GPU memory
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

## TAURI WINDOW CONFIGURATION (actual — src-tauri/tauri.conf.json)

```json
{
  "title": "Miwa",
  "width": 420,
  "height": 700,
  "x": 20,
  "y": 100,
  "alwaysOnTop": true,
  "transparent": true,
  "decorations": false,
  "shadow": false,
  "resizable": true,
  "minWidth": 380,
  "maxWidth": 500,
  "minHeight": 260
}
```

---

## CURRENT BUILD STATUS

| Component | Status |
|---|---|
| AMD MI300X instance | ❌ DESTROYED — recreate Day 5 (May 8) |
| Llama 3.3 70B downloaded | ❌ Was 263GB — must re-download when new droplet created |
| vLLM serving (background) | ❌ Destroyed with droplet |
| PyTorch + ROCm GPU access | ✅ Confirmed (prev session) |
| Japanese output confirmed | ✅ こんにちは (prev session) |
| Payment method added | ✅ |
| SSH key configured | ✅ miwa_amd (still exists locally) |
| Git repo connected | ✅ github.com/Mizunandayo/miwa |
| Tailwind v4 installed | ✅ @tailwindcss/vite |
| TypeScript configured | ✅ strict mode, tsconfig.json, @types/react |
| .gitignore | ✅ updated |
| .env.example | ✅ created |
| server/main.py (FastAPI) | ✅ DONE — running on ws://127.0.0.1:8765 |
| server/requirements.txt | ✅ locked (setuptools<71 fix applied) |
| bot/db.js | ✅ DONE — SQLite WAL, avatars + phrasebook tables |
| bot/index.js | ✅ DONE — VoiceReceiver, text chat, broadcastCallInfo, guild icon fetch |
| src/App.tsx | ✅ DONE — WS bridge, packet routing, resize handle, call_info handler |
| src/App.css | ✅ DONE — full design system, all component CSS |
| src/store/atoms.ts | ✅ DONE — all Jotai atoms + CallInfo/CallMember types |
| src/components/Header.tsx | ✅ DONE — drag, style modes, opacity, mini/click-through |
| src/components/SpeakerCard.tsx | ✅ DONE — avatar, karaoke, suggestions collapse/refresh |
| src/components/KaraokeText.tsx | ✅ DONE |
| src/components/RomajiLine.tsx | ✅ DONE |
| src/components/QuickReplyBox.tsx | ✅ DONE — 500ms debounce, style-aware, EN→JP live |
| src/components/CallInfoStrip.tsx | ✅ DONE — guild icon, member avatars, collapsible |
| Tauri window config | ✅ DONE — minHeight 260, shadow:false, x:20, y:100 |
| Tauri capabilities | ✅ DONE — core:window:allow-set-size added |
| Vertical resize handle | ✅ DONE — drag bottom edge, LogicalSize API |
| Suggestion refresh (↻) | ✅ DONE — random pool of 12, exclude-previous logic |
| QuickReply EN→JP bug fix | ✅ FIXED — google_translate source was hardcoded ja (now auto-detect) |
| src/components/SuggestionCard.tsx | ✅ DONE — Bot Speaks stub / Bot Sends / I'll Speak delivery buttons, 📌 save |
| src/components/RomajiPopup.tsx | ✅ DONE — fullscreen romaji overlay, Escape + click-outside close |
| src/components/QuickReactions.tsx | ✅ DONE — 草 えー マジ? gg もう一回 待って one-click botSends |
| src/components/Phrasebook.tsx | ✅ DONE — saved phrases, Ctrl+1-9 hotkeys, collapsible |
| src/components/StatsPanel.tsx | ✅ DONE — latency color-coded green/amber/red, WS status |
| README.md | ✅ DONE — full professional README written |
| hf-space/ | ⬜ NOT STARTED (Day 4 — create subfolder + 2 files) |
| bot/tts.js | ❌ NOT STARTED (Day 5 — XTTS v2) |
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

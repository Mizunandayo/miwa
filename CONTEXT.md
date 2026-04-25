# MIWA — AI CONTEXT FILE
## For use as conversation context in future AI sessions
## Last updated: May 2, 2026

---

## PROJECT IDENTITY

- **Name:** Miwa (美話 — "Beautiful Conversation")
- **Type:** Real-time Discord voice translation overlay (desktop app)
- **Event:** AMD Developer Hackathon on lablab.ai — May 4–11, 2026
- **Track:** Track 1 — AI Agents & Agentic Workflows
- **Hardware:** AMD Instinct MI300X (192GB HBM3) via AMD Developer Cloud
- **Budget:** $100 AMD Developer Cloud Credits
- **Deadline:** May 11, 2026 — 3:00 AM Philippine Standard Time (PHT)
- **Team:** Solo
- **GitHub:** https://github.com/Mizunandayo/miwa
- **lablab.ai event:** https://lablab.ai/ai-hackathons/amd-developer

---

## WHAT MIWA DOES

When you're in a Discord voice call with Japanese-speaking friends:
1. Miwa listens to the voice channel
2. Identifies WHO is speaking (shows their Discord avatar + name)
3. Transcribes what they said in Japanese (with word-level karaoke highlighting)
4. Shows romaji pronunciation below the Japanese text
5. Shows an English translation (in your chosen style: Formal / Neutral / Casual / Gaming)
6. Generates 3 context-aware Japanese reply suggestions
7. Lets you deliver replies via: Bot Speaks (voice), Bot Sends (text chat), or I'll Speak (romaji popup)
8. All of this in under 800ms end-to-end

---

## LOCAL WORKSPACE

- **Path:** `C:\Users\trist\Desktop\Programming\miwa`
- **Framework:** Tauri v2 + React 19 (Vite)
- **tauri.conf.json:** productName = "Miwa", identifier = "com.miwa.app"
- **Current UI state:** Default Tauri scaffold ("Welcome to Tauri + React") — not yet customized

---

## LOCAL ENVIRONMENT (verified May 2, 2026)

- Node.js: v25.9.0
- Python: 3.14.2
- Rust: 1.94.1
- Git: 2.52.0 (Windows)
- OS: Windows

---

## NPM PACKAGES INSTALLED (as of May 2, 2026)

### Frontend (package.json dependencies)
- react ^19.1.0
- react-dom ^19.1.0
- @tauri-apps/api ^2
- @tauri-apps/plugin-opener ^2

### Frontend devDependencies
- @vitejs/plugin-react ^4.6.0
- vite ^7.0.4
- @tauri-apps/cli ^2

### Discord bot / local services (also in package.json)
- discord.js (v14)
- @discordjs/voice
- prism-media
- sharp
- better-sqlite3
- ws
- dotenv

### NOT YET INSTALLED
- tailwindcss v4
- @tailwindcss/vite
- framer-motion
- jotai
- @tauri-apps/plugin-shell (or plugin-window for always-on-top)

---

## CREDENTIALS & ACCOUNTS STATUS (May 2, 2026)

| Item | Status |
|---|---|
| Llama 3.3 70B HuggingFace access | ✅ APPROVED (approved May 2, 2026) |
| HuggingFace token | ✅ Created — named "overlaychat-amd", Read gated repos permission |
| Google Translate API key | ✅ Created — named "Miwa API Key", restricted to Cloud Translation API |
| AMD Developer Cloud credits | ⏳ PENDING — waiting for email from AMD AI Developer Program |
| AMD Developer Cloud account | ⬜ Not created yet — create when credit email arrives |
| Discord bot | ⏳ In progress — permissions set, token needs to be saved to .env |
| GitHub repo | ✅ Created: https://github.com/Mizunandayo/miwa (public) |
| Git initialized locally | ⬜ Not yet — need to `git init` and push |
| HuggingFace hackathon org | ⬜ Not joined yet |
| HF org join link | https://huggingface.co/organizations/lablab-ai-amd-developer-hackathon/share/ELARrxoRIHvseSHRhANJYFEZQazsQIYhJf |
| HF org name | lablab-ai-amd-developer-hackathon |

---

## FULL TECH STACK (30 technologies)

| # | Category | Technology | Purpose |
|---|---|---|---|
| 1 | Voice Capture | discord.js v14 | Join voice channels, track speaker via voice state |
| 2 | Audio Decode | @discordjs/voice | Receive per-user audio streams |
| 3 | Audio Processing | prism-media | Decode Opus audio to PCM |
| 4 | Speech-to-Text | WhisperX | Transcribe Japanese with word timestamps |
| 5 | STT Model | Whisper Large-V3-Turbo | Best accuracy/speed for Japanese |
| 6 | GPU Platform | ROCm 7 / HIP | AMD GPU computing (= CUDA equivalent) |
| 7 | First Translation | Google Translate API v3 | Fast first-pass translation <100ms |
| 8 | LLM Primary | Llama 3.3 70B Instruct | Translation refinement + suggestion generation |
| 9 | LLM Secondary | Qwen2.5-72B-Instruct | Korean/Chinese paths, Qwen prize eligibility |
| 10 | LLM Serving | vLLM + ROCm AITER | Serve 70B models on MI300X |
| 11 | Japanese NLP | MeCab + Janome | Furigana + romaji generation |
| 12 | Voice Synthesis | XTTS v2 | Japanese TTS for bot voice + local preview |
| 13 | Vector Database | Qdrant | Per-speaker conversation memory |
| 14 | AI Agents | CrewAI | Multi-agent suggestion pipeline |
| 15 | LLM Orchestration | LangChain | Connect LLM with tools, memory, agents |
| 16 | API Backend | FastAPI + uvicorn | Async Python API server on AMD Cloud |
| 17 | WebSocket | ws (Node.js) | Low-latency bidirectional comms |
| 18 | Security | SSH Port Forwarding | Secure tunnel — no public ports |
| 19 | Containerization | Docker + ROCm image | Cloud deployment |
| 20 | Image Processing | sharp | Fetch + optimize Discord profile pictures |
| 21 | Local Cache | SQLite (better-sqlite3) | Cache profile pictures + phrasebook |
| 22 | Desktop Framework | Tauri v2 | Native Windows overlay, Rust backend |
| 23 | Frontend | React 19 | Speaker cards, suggestion UI |
| 24 | Styling | TailwindCSS v4 | Utility-first styling |
| 25 | Animation | Framer Motion | Card transitions + word highlight animations |
| 26 | State Management | Jotai | Atomic state for style mode, speakers, settings |
| 27 | Build Tool | Vite | Frontend bundling + hot reload |
| 28 | Runtime | Python 3.11+ + Node 18+ | Server + client runtimes |
| 29 | Version Control | Git + GitHub | Public repo for submission |
| 30 | Hugging Face | HF Hub + Spaces | Model hosting + web demo Space |

---

## ARCHITECTURE

```
Discord Voice Channel
        │ per-user Opus audio
        ▼
Local Machine (Windows)
  discord.js + @discordjs/voice
  → identifies speaker by Discord user ID
  → decodes Opus → PCM
  → fetches + caches Discord avatar (sharp + SQLite)
        │
        │ SSH tunnel WebSocket (secure, no public ports)
        ▼
AMD Developer Cloud (MI300X 192GB HBM3)
  FastAPI WebSocket Server
    ├── WhisperX → Japanese text + word timestamps
    ├── Google Translate API → fast first EN translation (sent immediately to overlay)
    ├── vLLM (Llama 3.3 70B / Qwen2.5-72B) → style-refined translation + 3 suggestions
    ├── MeCab/Janome → romaji + furigana
    ├── Qdrant → per-speaker conversation history
    ├── CrewAI → multi-agent suggestion generation using history
    └── XTTS v2 → Japanese audio for Bot Speaks + Hear It preview
        │
        │ JSON packets via WebSocket
        ▼
Tauri v2 Overlay (React 19 UI)
  → Speaker cards with avatar + JP + romaji + EN
  → Word-level karaoke highlight (driven by WhisperX timestamps)
  → Style mode toggle (Formal/Neutral/Casual/Gaming)
  → 3 suggestion cards
  → AMD Stats Panel (live latency, tok/s, GPU mem)
  → Always-on-top, draggable, opacity slider
```

**Target latency:** Under 800ms from speech end to full card shown
**Two-pass translation:** Google Translate shown immediately (~100ms), then LLM refines it (~700ms)

---

## DATA FLOW (one message)

1. Friend speaks Japanese in Discord
2. discord.js detects speaker, captures audio
3. PCM sent over SSH WebSocket to AMD Cloud
4. WhisperX transcribes → Japanese text + word timestamps
5. Google Translate → fast English result → sent to overlay immediately (shows in ~100ms)
6. vLLM refines to selected style mode
7. MeCab generates romaji
8. CrewAI queries Qdrant for speaker history → generates 3 suggestions
9. Final result updates the overlay card
10. Total: under 800ms

---

## UI FEATURES (complete list)

### Incoming (what friends say)
- Speaker avatar + name display
- Live Japanese transcription (word-by-word as they speak)
- Word-level karaoke highlight (synced to WhisperX timestamps)
- Romaji pronunciation below each line
- English translation with style mode applied
- Translation style toggle: Formal / Neutral / Casual / Gaming
- JP / EN / Both toggle
- Emotion tone indicator (excited, frustrated, confused, happy)
- Multi-speaker support (up to 5 simultaneous speakers)
- Speaker focus mode

### Outgoing (what you want to say)
- 3 AI suggestion cards (context-aware, styled)
- Suggestion delivery: Bot Speaks (XTTS v2 in voice channel)
- Suggestion delivery: Bot Sends (bot types in text channel)
- Suggestion delivery: I'll Speak (large romaji popup card)
- Local TTS preview: Hear It (plays privately through your headphones)
- Quick Reply Box (type English → live JP translation)
- Quick Reactions: 草, えー, マジ?, gg, もう一回, 待って
- Pronunciation difficulty badge (N5/N4/N3)

### Memory & Learning
- Context memory (last 10 messages per speaker via Qdrant)
- Personal phrasebook (save with one click, Ctrl+1 to Ctrl+9)
- Post-session summary (message count, speakers, new phrases, duration)
- Session export (.txt)
- Smart silence detector (suggests continuer after 5+ seconds silence)

### Overlay experience
- Always-on-top window
- Draggable header
- Snap to corner (double-click header)
- Mini mode (single-line compact view)
- Opacity slider (40%–100%)
- Click-through mode (mouse passes through to game)
- Overlay screenshot (one-click PNG)
- Demo Mode (pre-recorded session — no live Discord needed for demos)
- AMD Stats Panel (latency, tokens/sec, GPU memory)

---

## 7-DAY HACKATHON TIMELINE

| Day | Date | Focus |
|---|---|---|
| 1 | May 4 | Infrastructure: WebSocket + Discord audio + Tauri overlay showing text |
| 2 | May 5 | Translation + profile pictures + multi-speaker UI |
| 3 | May 6 | LLM (vLLM + Llama 3.3 70B) + CrewAI agents + Qdrant memory |
| 4 | May 7 | Suggestions + Quick Reply + all 3 delivery methods + phrasebook |
| 5 | May 8 | Polish + Framer Motion animations + .exe build + test on second machine |
| 6 | May 9 | GitHub finalize + HuggingFace Space + demo video + submission form |
| 7 | May 10 | Final review + SUBMIT (before May 11 3:00 AM PHT) |

**Day 1 critical path:** Test Discord VoiceReceiver per-user audio FIRST. If it fails, nothing else works.

---

## PRIZE PATHS

| Prize | Requirement |
|---|---|
| Track 1 winner ($2,500) | Best AI Agents & Agentic Workflows project |
| Grand Prize ($5,000) | Overall top project |
| Qwen category | Use Qwen2.5-72B meaningfully |
| HuggingFace prize | Most likes on Space in org |
| Ship It (AMD GPU prize) | 2+ social media posts tagging @AIatAMD and @lablab, meaningful AMD feedback |

---

## BUDGET

AMD MI300X at ~$2–4/GPU-hour. Total estimated: $44–88. Reserve: $12–56. Budget cap: $100.

**Cost rules:**
- Stop instance when not actively developing
- Use persistent volume for model weights (avoid re-downloading 140GB)
- Use Whisper large-v3-turbo (6x faster than v3)
- Switch to smaller Whisper model during testing

---

## PRE-HACKATHON TODO (remaining)

### Accounts & Credentials
- [ ] AMD Developer Cloud account (when credit email arrives)
- [ ] AMD cloud credits confirmed
- [ ] Discord bot token → save to .env
- [ ] Join HF org: https://huggingface.co/organizations/lablab-ai-amd-developer-hackathon/share/ELARrxoRIHvseSHRhANJYFEZQazsQIYhJf
- [ ] Verify Google Translate API key with test call
- [ ] Twitter/LinkedIn ready for Ship It posts

### Frontend deps to install
```
npm install framer-motion jotai
npm install -D tailwindcss @tailwindcss/vite
npm install @tauri-apps/plugin-shell
```

### Git setup
```
git init
git remote add origin https://github.com/Mizunandayo/miwa.git
git add .
git commit -m "initial scaffold"
git push -u origin main
```

### .env file (fill in actual values)
```
DISCORD_TOKEN=
GOOGLE_TRANSLATE_KEY=
HF_TOKEN=
AMD_CLOUD_WS_URL=
```

### .gitignore must include
```
node_modules/
.env
src-tauri/target/
__pycache__/
*.pyc
dist/
```

---

## KEY DECISIONS MADE

1. **Two-pass translation** (Google Translate first pass <100ms + LLM refinement) — makes UI feel instant
2. **Cloud GPU** (AMD MI300X) over local GPU — 192GB VRAM, full FP16 70B model, no quantization needed
3. **WebSocket** over HTTP polling — required for real-time word highlighting
4. **Tauri v2** over Electron — 50MB app, native performance, no Chromium overhead
5. **WhisperX** over standard Whisper — word-level timestamps built in (needed for karaoke)
6. **Always use Demo Mode** for judge presentation — live Discord call as bonus only
7. **vLLM + AITER backends** — 2.8–4.4x throughput improvement on MI300X

---

## HOW TO RESUME WORK WITH AI

When starting a new AI chat, paste this file as context or say:
"Read CONTEXT.md in my workspace at C:\Users\trist\Desktop\Programming\miwa\CONTEXT.md — that's the full project context."

The blueprint is also in MIWA_BLUEPRINT.md in the same folder for full detail.

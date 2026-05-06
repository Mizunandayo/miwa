# MEMORY.md — Conversation Backup
## AMD Developer Hackathon 2026 — Miwa Build Log

---

## SESSION 1 — May 4, 2026 (Pre-build setup)

### Key decisions made
- Project name: Miwa (美話 — Beautiful Conversation)
- Track: Track 1 — AI Agents & Agentic Workflows
- Solo participant: Francis Daniel (Mizu)
- Full tech stack finalized (30 technologies) — see MIWA_BLUEPRINT.md
- Timeline: May 4–11, 7 days

### Credentials obtained
- HuggingFace token: created, named `miwa-overlayamd`, Read gated repos
- Llama 3.3 70B: approved for gated access
- Google Translate API key: created, named "Miwa API Key"
- Discord bot: created, token saved in .env

### Pre-build completed
- Tauri v2 + React 19 scaffold created (productName: Miwa, identifier: com.miwa.app)
- npm packages installed: discord.js, @discordjs/voice, prism-media, sharp, better-sqlite3, ws, dotenv, framer-motion, jotai, @tailwindcss/vite

---

## SESSION 2 — May 4–5, 2026 (AMD Cloud setup)

### AMD Cloud conversation summary
- Mizu spoke with AMD team — credits were delayed (submitted May 2, AMD processes up to Thursday)
- Email arrived May 4 23:16 PHT: "You've been approved for AMD Developer Cloud access"
- Name on account: Francis Daniel

### AMD Cloud provisioned
- Plan: MI300X x1 (single GPU) — $1.99/hr
- Image: vLLM 0.17.1 on ROCm 7.2.0 (Ubuntu 24.04)
- Public IP: **165.245.134.220**
- Private IP: 10.128.0.2
- SSH key: `miwa_amd` (ed25519, generated locally)
- Payment method: added ✅

### GPU verification
```
rocm-smi output:
Device 0 | MI300X | 36°C | 154W | VRAM 0% | GPU 0%
```
- PyTorch `torch.cuda.is_available()` → True ✅
- vLLM version: 0.17.1 ✅
- Disk: 636GB free (696GB total) ✅

### Llama 3.3 70B download
- Started: ~May 4 11:50 PM PHT
- Command: `nohup huggingface-cli download meta-llama/Llama-3.3-70B-Instruct --local-dir /app/models/llama3.3-70b > /app/download.log 2>&1 &`
- HF token used: `miwa-overlayamd`
- Completed overnight: 263GB at `/app/models/llama3.3-70b/` ✅
- All 30 safetensor shards present (model-00001 to model-00030) ✅

### vLLM serving confirmed
- Command: `nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &`
- Loaded: 131.62 GiB into GPU
- API startup: complete ✅
- Current PID: 1695
- Japanese output test: `こんにちは` ✅

---

## CURRENT STATE — May 5, 2026 (Morning)

### Cloud: FULLY READY
- MI300X running ✅
- vLLM serving Llama 3.3 70B on port 8000 ✅
- Japanese confirmed working ✅

### Local: NOT STARTED
- Discord bot code: ❌
- FastAPI WebSocket server: ❌
- React UI components: ❌
- Tauri window config: ❌
- .gitignore: needs review
- CLAUDE.md: ✅ created
- MEMORY.md: ✅ this file

---

## SESSION 3 — May 5, 2026 (Day 2 Build Guide Delivered)

### AMD Cloud — Droplet destroyed (correct decision)
- Used $16.09 of $100 credits overnight (MI300X x1 @ $1.99/hr)
- Destroying is only way to stop billing on DigitalOcean-based AMD cloud
- Turn Off does NOT stop billing — only Destroy does
- Remaining credit: ~$83.91 (~42 hrs GPU time)
- Plan: Recreate droplet Day 5 (May 8) when cloud features needed
- Re-download Llama 3.3 70B takes 1-2 hrs when recreated

### Day 2 Tasks — Implementation Guide Delivered
User will implement the following files:

**New files to create:**
- `.gitignore` — covers node_modules, .env, target/, *.sqlite, .venv
- `.env.example` — safe template for GitHub
- `bot/index.js` — Discord bot + VoiceReceiver + WS bridge
- `bot/db.js` — SQLite helper (avatars + phrasebook)
- `server/main.py` — FastAPI WS server, GT translation, pykakasi romaji
- `server/requirements.txt` — Python deps
- `src/store/atoms.js` — Jotai atoms (speakers, settings, suggestions, stats)
- `src/components/SpeakerCard.jsx` — avatar + JP + romaji + EN card
- `src/components/KaraokeText.jsx` — word-by-word Framer Motion highlight
- `src/components/RomajiLine.jsx` — Geist Mono romaji display
- `src/components/Header.jsx` — drag handle, style modes, opacity slider

**Files to modify:**
- `src-tauri/tauri.conf.json` — alwaysOnTop, transparent, decorations: false, 420x700, CSP
- `src-tauri/src/lib.rs` — set_opacity, set_click_through, set_always_on_top commands
- `src/App.jsx` — WS connection manager, Jotai state updates, speaker orchestration
- `src/App.css` — full design system (OLED dark, CSS variables, Geist font)
- `src/main.jsx` — add App.css import
- `vite.config.js` — add @tailwindcss/vite plugin

### WebSocket Architecture (finalized)
- Port **8765**: Bot ↔ AMD cloud server (bot/index.js ↔ server/main.py)
- Port **8766**: Bot → Tauri UI (bot broadcasts JSON, React listens)
- Both bound to 127.0.0.1 only — never exposed to network
- CSP in tauri.conf.json restricts connect-src to ws://localhost:8765 and ws://localhost:8766

### Design System (applied)
- Vibe: Ethereal Glass — OLED black #050505 base
- Font: Geist Variable + Geist Mono Variable (npm: @fontsource-variable/geist)
- Accent: #3b9eff (Electric Blue — NO purple/blue AI gradients)
- Cards: rgba(255,255,255,0.04) + border-white/8 + backdrop-blur-xl + inner shadow
- Speaking indicator: green pulse dot (#22c55e) with CSS keyframe animation
- Karaoke: Framer Motion color animate per word (no useState for animation)
- Translation source badge: GT (Google) vs AI (LLM) with color coding

### npm packages needed for Day 2
```powershell
npm install @fontsource-variable/geist @fontsource-variable/geist-mono
```

### Python venv setup
```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install fastapi==0.115.0 uvicorn[standard]==0.30.0 websockets==12.0 requests==2.32.0 pykakasi==2.2.1 python-dotenv==1.0.0
pip freeze > requirements.txt
```

### Security measures applied
- WS servers bound to 127.0.0.1 only
- Tauri CSP restricts WebSocket origins
- Max audio payload: 2MB (OOM prevention)
- Max text length: 500 chars
- All SQLite queries parameterized
- Env vars validated on bot startup (fail fast)
- Text sanitized before forwarding to UI
- Audio stream capped at 10s to prevent memory growth

### Test procedure (Day 2)
1. Terminal 1: `cd server && .venv\Scripts\activate && python main.py`
2. Terminal 2: `node bot/index.js`
3. Terminal 3: `npm run tauri dev`
4. Test WS directly via browser DevTools (no Discord needed for UI testing)

### Pending (Day 3 tasks)
- Local Whisper STT (CPU, small model) stub replacement
- SuggestionCard.jsx
- RomajiPopup.jsx (fullscreen I'll Speak)
- QuickReplyBox.jsx
- QuickReactions.jsx
- Bot Sends delivery wired up
- Phrasebook with Ctrl+1-9 hotkeys
5. Install Tailwind properly in `src/main.jsx`
6. Create `src/components/SpeakerCard.jsx`
7. Create `src/store/atoms.js` — Jotai atoms
8. Wire WebSocket to Tauri backend → React state
9. Test full loop: Discord audio → cloud → overlay text

---

---

## SESSION 4 — May 5, 2026 (Day 2 Active Implementation)

### Completed this session
- ✅ `.gitignore` — rewritten with proper exclusions (server/.venv/, *.sqlite, .env.*, etc.)
- ✅ `.env.example` — safe template pushed to GitHub
- ✅ `server/main.py` — FastAPI WebSocket server written and running on ws://127.0.0.1:8765
- ✅ `server/requirements.txt` — locked with pip freeze
- ✅ `tsconfig.json` — created with strict mode
- ✅ `src/main.jsx` → `src/main.tsx` — renamed
- ✅ `src/App.jsx` → `src/App.tsx` — renamed
- ✅ TypeScript packages installed: typescript, @types/react, @types/react-dom, @types/node
- ✅ `src/main.tsx` — added non-null assertion `getElementById("root")!`

### Key fix: pykakasi / setuptools issue
- **Error:** `ModuleNotFoundError: No module named 'pkg_resources'`
- **Cause:** setuptools 82 removed `pkg_resources` from top-level namespace
- **Fix:** `pip install "setuptools<71"` inside `server/.venv`
- **Server run command:** `cd server ; .venv\Scripts\python.exe main.py`
- **Why not `python main.py`:** PowerShell loses venv activation across chained commands; use venv's python.exe directly

### TypeScript decision (made this session)
- **React frontend (`src/`):** TypeScript — strict mode, catches bugs before runtime
- **Discord bot (`bot/`):** JavaScript — stays JS for hackathon simplicity
- **Python server (`server/`):** Python — different runtime, no TS possible
- **Migration cost was ~0:** made before any components were written
- **Post-hackathon:** can migrate bot to TS after deadline

### Language decision rationale
- User asked about TypeScript mid-session
- Agreed: JS = "delayed error", TS prevents issues at compile time
- Switched immediately since no component code existed yet
- All future `src/` files will be `.tsx` / `.ts`

### New feature added this session: Voice channel text sidechat capture
- `messageCreate` event in bot/index.js listens for typed messages in the VC's text chat
- Same two-pass translation pipeline (GT fast → LLM refined)
- Overlay card identical to voice card — no karaoke animation (no word timestamps from text)
- `source` field in WS packet: `"voice"` vs `"text_chat"`
- UI shows 💬 icon instead of 🎙️ mic icon to distinguish source
- Cards auto-dismiss after same timeout as voice cards (~8s)
- Zero extra dependencies — uses existing discord.js messageCreate event

### In progress (bot/index.js, UI components)
- `bot/db.js` — being coded by user
- `bot/index.js` — next after db.js (must include messageCreate listener)
- Tauri window config — pending
- React components — pending (all .tsx going forward)

---

## SESSION 5 — May 5, 2026 (Day 2 Full Implementation Guide Delivered)

### Scope of guide delivered
Complete step-by-step guide for ALL Day 2 tasks. User codes it themselves.

### Files covered in guide (15 steps)
1. `bot/db.js` — completed (WAL SQLite, avatars + phrasebook tables, UPSERT, TTL cache)
2. `bot/index.js` — created (Discord VoiceReceiver, text chat listener, dual WS, speakerCache)
3. `vite.config.js` — Tailwind plugin added before react()
4. `src/App.css` — full design system (OLED #050505, glass cards, Geist fonts, speaking-pulse keyframe)
5. `src/main.tsx` — added App.css import
6. `src/App.tsx` — WS manager, Jotai atoms, AnimatePresence, 8s speaker auto-removal
7. `src/store/atoms.ts` — all Jotai atoms with TypeScript types
8. `src/components/Header.tsx` — drag-region, style buttons, opacity slider, mini/click-through
9. `src/components/SpeakerCard.tsx` — avatar, JP/romaji/EN, 💬 vs 🎙️, speaking dot, suggestions
10. `src/components/KaraokeText.tsx` — Framer Motion word highlight (last word while speaking)
11. `src/components/RomajiLine.tsx` — Geist Mono romaji display, returns null if empty
12. `src-tauri/tauri.conf.json` — 420×700, alwaysOnTop, transparent, decorations:false, CSP
13. `src-tauri/src/lib.rs` — set_opacity, set_click_through, set_always_on_top, get_window_position
14. `src-tauri/capabilities/default.json` — window permissions added
15. `src/components/index.ts` — barrel export (optional)

### Key architectural decisions made in guide

#### speakerCache pattern
- Server returns `userId` but NOT `username`/`avatarB64`/`source`
- Bot maintains a local `Map<userId, {username, avatarB64, source}>` called `speakerCache`
- When server response arrives, bot merges cached info before broadcasting to UI
- This keeps server stateless and bot responsible for Discord-specific data

#### data-tauri-drag-region vs JS startDragging()
- Used `data-tauri-drag-region` HTML attribute on `.drag-handle` div
- Zero JS needed, no capability permission required
- More reliable than `invoke("startDragging")`

#### WS architecture confirmed
- Port 8765: bot ↔ server/main.py (translation pipeline)
- Port 8766: bot → Tauri React UI (enriched packets with avatar/username)
- Both 127.0.0.1 only — never exposed to network

#### Speaker card lifecycle
- `fast` packet → card appears with GT translation, isSpeaking=true, speaking dot visible
- `refined` packet → card updates with LLM translation + suggestions, isSpeaking=false
- 8s timeout → card animates out via AnimatePresence
- Any new packet from same userId resets the 8s timer

#### Voice channel text chat (💬)
- `messageCreate` event filters by `channelId === currentVoiceChannelId`
- Japanese detection regex: `/[\u3000-\u9fff\uff00-\uffef]/`
- Sanitizes mentions/channel refs before sending to server
- `source: "text_chat"` in packet — UI shows 💬 icon, no karaoke animation

### Important Tauri v2 notes
- `window.set_opacity()` may need `features = ["unstable"]` in Cargo.toml tauri dependency
- `transparent: true` in tauri.conf.json MUST pair with `background: transparent` in CSS
- `selfDeaf: false` in joinVoiceChannel() is REQUIRED to receive audio (selfDeaf=true mutes input)
- Capabilities/default.json must explicitly list: allow-set-always-on-top, allow-set-ignore-cursor-events, allow-set-opacity, allow-start-dragging

### Test procedure (3 terminals)
```powershell
# Terminal 1 — server
cd server ; .venv\Scripts\python.exe main.py

# Terminal 2 — bot
node bot/index.js

# Terminal 3 — overlay
npm run tauri dev
```
Expected: Overlay opens → status green → `!join` in Discord → status shows VC name in blue → speak Japanese → card appears

### Run commands (confirmed working)
```powershell
# Server (use venv python directly)
cd server ; .venv\Scripts\python.exe main.py

# Bot (after bot/index.js is written)
node bot/index.js

# Tauri overlay
npm run tauri dev
```

---

## ARCHITECTURE DECISIONS (rationale)

| Decision | Choice | Why |
|---|---|---|
| Translation speed | Two-pass (GT + LLM) | GT at <100ms feels instant, LLM refines at ~700ms |
| GPU | AMD MI300X cloud | 192GB VRAM = full FP16 70B, no quantization loss |
| Desktop | Tauri v2 | 50MB vs Electron 200MB, native always-on-top |
| Realtime | WebSocket | Required for word-by-word karaoke streaming |
| Romaji | pykakasi | Pure Python, no native deps, easy cloud install |
| Tunnel | SSH port forwarding | No public ports, all through port 22 |

---

## IMPORTANT NOTES

- **vLLM only runs inside the Docker container `rocm`** — must `docker exec -it rocm /bin/bash` first
- **Do not run two vLLM processes** — they fight over GPU memory and both crash
- **vLLM takes ~2 minutes to load** after starting — check log before testing
- **SSH terminal doesn't render Japanese** — pipe through `python3 -c "import sys,json; ..."` to see actual characters
- **AMD credits expire in 30 days** from activation
- **Droplet destroyed if payment method missing and credits run out** — payment added May 5

---

## COMMANDS CHEATSHEET

```bash
# SSH into AMD cloud
ssh -i "$HOME\.ssh\miwa_amd" -o StrictHostKeyChecking=no root@165.245.134.220

# Enter vLLM Docker container
docker exec -it rocm /bin/bash

# Start vLLM (background, survives SSH disconnect)
nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &

# Check if vLLM is ready
curl -s http://localhost:8000/health

# Test Japanese output
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"/app/models/llama3.3-70b","messages":[{"role":"user","content":"Reply only in Japanese: say hello"}],"max_tokens":30}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'])"

# SSH tunnel (for local dev pointing at cloud)
ssh -i "$HOME\.ssh\miwa_amd" -N -L 8000:localhost:8000 root@165.245.134.220

# Local dev
npm run tauri dev
```

---

## SESSION 6 — May 6, 2026 (Day 3 — UI Polish & CallInfo)

### Full Task Status as of end of Day 3

#### Day 1 ✅ Complete
- ✅ Git repo, Tailwind v4, TypeScript strict, .gitignore, .env.example
- ✅ AMD MI300X provisioned, SSH key (miwa_amd), PyTorch+ROCm confirmed
- ✅ Llama 3.3 70B downloaded (263GB), vLLM serving confirmed, Japanese output confirmed

#### Day 2 ✅ Complete
- ✅ main.py, requirements.txt, db.js, index.js, atoms.ts
- ✅ App.tsx, Header.tsx, SpeakerCard.tsx, KaraokeText.tsx, RomajiLine.tsx
- ✅ Tauri window config, opusscript, .env /ws bug fix, server idle timeout fix
- ✅ Full pipeline end-to-end confirmed (real avatars, <800ms)

#### Day 3 🔨 In Progress
- ✅ QuickReplyBox.tsx — 500ms debounce, style-aware EN→JP
- ✅ quickReplyResultAtom, quickReplyLoadingAtom
- ✅ Server quick_reply handler
- ✅ google_translate source bug fixed ("source":"ja" hardcode removed)
- ✅ Suggestion chips — collapse/expand, EN text, refresh pool of 12
- ✅ Vertical resize handle (LogicalSize API, core:window:allow-set-size)
- ✅ CallInfoStrip.tsx — guild icon, member avatars, collapsible
- ✅ callInfoAtom + broadcastCallInfo() + fetchGuildIconBase64()
- ⬜ SuggestionCard delivery buttons (Bot Speaks / Bot Sends / I'll Speak)
- ⬜ RomajiPopup.tsx
- ⬜ QuickReactions.tsx
- ⬜ Phrasebook.tsx
- ⬜ StatsPanel.tsx
- ⬜ Git commit + push

### Completed this session (all AI-implemented, not just guided)

#### QuickReplyBox
- ✅ Fully rewritten as debounced live EN→JP translator
- 500ms debounce on input, re-runs on style mode change
- Send button posts JP to Discord via `{ action: "botSends", text: result.jp }`
- Escape clears input, spinner animation while translating
- **Critical bug fixed:** `google_translate()` in server/main.py had hardcoded `"source": "ja"` — EN→JP returned English unchanged. Fixed by removing source field (auto-detect).

#### Suggestion Chips
- ✅ Collapsed by default (click "REPLY WITH ▸" to expand)
- ✅ Each chip shows JP (top) + EN (bottom, muted small text) + romaji (right)
- ✅ Refresh button (↻) — picks 3 new from pool of 12, excludes previously shown
- ✅ Smooth height animation via Framer Motion AnimatePresence
- ✅ server/main.py: `SUGGESTION_POOL` (12 entries) + `pick_suggestions(exclude)` function
- ✅ `refresh_suggestions` packet type: server returns `suggestionsOnly: True` to avoid overwriting JP/EN/romaji

#### Vertical resize handle
- ✅ Drag bottom edge to resize overlay height
- ✅ Uses `getCurrentWindow().setSize(new LogicalSize(w, h))` from @tauri-apps/api
- ✅ `core:window:allow-set-size` added to capabilities/default.json
- ✅ `minHeight: 260` added to tauri.conf.json
- ✅ CSS: `height: 100vh` on .overlay-root (was hardcoded 700px)

#### CallInfoStrip (new component)
- ✅ `src/components/CallInfoStrip.tsx` — collapsible strip showing guild, channel, member list
- ✅ Collapsed: [guild icon] ServerName · #channel · N in call  ▸
- ✅ Expanded: animated member list with round avatars + usernames
- ✅ `callInfoAtom` + `CallInfo` + `CallMember` interfaces added to atoms.ts
- ✅ App.tsx handles `type: "call_info"` packet → sets/clears callInfoAtom
- ✅ App.tsx handles `suggestionsOnly: true` on refined packets (only patches suggestions field)
- ✅ CSS: full `.call-info-*` block in App.css

#### bot/index.js — broadcastCallInfo
- ✅ `broadcastCallInfo()` — async, fetches guild icon + all VC member avatars in parallel
- ✅ `fetchGuildIconBase64()` — fetches `cdn.discordapp.com/icons/{id}/{hash}.png`, resize 64×64
- ✅ Broadcasts `{ type: "call_info", guildName, guildIconB64, channelName, members[] }`
- ✅ Called on: UI client connect (200ms delay), VoiceConnectionStatus.Ready, on join
- ✅ Clears with `guildName: ""` on disconnect
- `guildIconB64` sent on `call_info` packet — shows as rounded-square image in strip
- Member avatars fetched eagerly for ALL VC members, not just those who have spoken

#### CallInfo types updated
- `CallInfo.guildIconB64: string | null` added to atoms.ts interface
- App.tsx passes `guildIconB64` from packet through to atom
- CallInfoStrip renders `<img>` for guild icon, falls back to ⚡ text

### Bugs encountered & fixed this session
1. **`attachVoiceReceiver` function body lost its `function` header** — two multi_replace operations corrupted bot/index.js. Fixed by manually re-adding closing `}` to complete function body.
2. **QuickReply showed no JP output** — server had `"source": "ja"` hardcoded in google_translate(). Fixed: removed source field.
3. **CallInfoStrip TS error** — stale language server cache after new file creation. File itself is valid; error clears on restart.

### Current state of all components
| Component | Status |
|---|---|
| Header.tsx | ✅ Complete |
| SpeakerCard.tsx | ✅ Complete (suggestions collapse/refresh) |
| KaraokeText.tsx | ✅ Complete |
| RomajiLine.tsx | ✅ Complete |
| QuickReplyBox.tsx | ✅ Complete |
| CallInfoStrip.tsx | ✅ Complete |
| StatsPanel.tsx | ❌ Not started |
| RomajiPopup.tsx | ❌ Not started |
| QuickReactions.tsx | ❌ Not started |
| Phrasebook.tsx | ❌ Not started |

### Day 5 plan (May 8) — Cloud tasks
- Recreate AMD MI300X droplet ($1.99/hr, ~$83 remaining)
- Re-download Llama 3.3 70B (263GB, ~1-2hrs)
- Start vLLM: `nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &`
- SSH tunnel: `ssh -i "$HOME\.ssh\miwa_amd" -N -L 8765:localhost:8765 root@<new-ip>`
- Install WhisperX, Qdrant, CrewAI, XTTS v2 on cloud

### Run commands (current local dev)
```powershell
# Terminal 1 — server
cd server ; .venv\Scripts\python.exe main.py

# Terminal 2 — bot (restart needed after bot changes)
node bot/index.js

# Terminal 3 — overlay (full rebuild after capability changes)
npm run tauri dev
```

---

## SESSION 7 — May 6, 2026 (Day 3 — Remaining Tasks: Implementation Guide)

### Guide delivered for these pending Day 3 tasks
- ⬜→✅ SuggestionCard.tsx — delivery buttons (Bot Speaks / Bot Sends / I'll Speak)
- ⬜→✅ RomajiPopup.tsx — fullscreen romaji overlay for "I'll Speak"
- ⬜→✅ QuickReactions.tsx — 草 えー マジ? gg もう一回 待って
- ⬜→✅ Phrasebook.tsx — saved phrases, Ctrl+1-9 hotkeys
- ⬜→✅ StatsPanel.tsx — latency display, WS status
- ⬜→✅ Git commit + push Day 3 work

### Files to CREATE (new)
1. `src/components/SuggestionCard.tsx`
2. `src/components/RomajiPopup.tsx`
3. `src/components/QuickReactions.tsx`
4. `src/components/Phrasebook.tsx`
5. `src/components/StatsPanel.tsx`

### Files to MODIFY
- `src/store/atoms.ts` — append: `romajiPopupAtom`, `phrasebookAtom`, `phrasebookOpenAtom` + their interfaces
- `src/components/index.ts` — add exports for all 5 new components + QuickReplyBox + CallInfoStrip
- `src/components/SpeakerCard.tsx` — import SuggestionCard; replace `.suggestion-chips` div with `.suggestion-cards` + `<SuggestionCard>`
- `src/App.tsx` — new imports, new atom `setPhrasebook`, new `phrasebook` packet type in handlePacket, add QuickReactions+Phrasebook+StatsPanel+RomajiPopup to JSX
- `src/App.css` — append CSS for all new components
- `bot/index.js` — update import (add savePhrase, getPhrasebook, deletePhrase), send phrasebook on connect, add savePhrase/deletePhrase/botSpeaks handlers to handleUiCommand
- `bot/db.js` — NO CHANGE needed (savePhrase, getPhrasebook, deletePhrase, getPhraseBySlot all already exist)

### Architecture decisions made this session
- `romajiPopupAtom` in Jotai so SuggestionCard + Phrasebook can both trigger it without prop drilling
- `phrasebookAtom` in Jotai — synced from bot via `type: "phrasebook"` WS packet on save/delete/connect
- Auto slot assignment (1-9) done in bot's handleUiCommand — queries existing slots, assigns first free
- `botSpeaks` implemented as a logged stub — Day 5 will wire XTTS v2
- `deletePhrase` validates id as positive integer before calling db
- `botSends` in handleUiCommand now has `.trim().slice(0, 500)` validation (security hardening added)
- QuickReactions uses hardcoded array — no atom needed (fixed data)
- StatsPanel hidden when `stats.lastUpdated === 0` — no wasted space before first packet

### Render order in App.tsx (final Day 3)
```
overlay-root
├── Header
├── QuickReplyBox
├── CallInfoStrip
├── QuickReactions      ← NEW
├── speaker-list (flex:1 scrollable)
├── Phrasebook          ← NEW
├── StatsPanel          ← NEW
├── resize-handle
└── RomajiPopup         ← NEW (position:fixed overlay, renders last)
```

### Phrasebook WS protocol
- Bot → UI: `{ type: "phrasebook", phrases: [{ id, slot, jp, romaji, en }] }`
- UI → Bot: `{ action: "savePhrase", jp, romaji, en }`
- UI → Bot: `{ action: "deletePhrase", id }`
- Sent: on UI connect (300ms delay), after save, after delete

### Security hardening done
- `botSends` in handleUiCommand: added `.trim().slice(0, 500)` validation
- `savePhrase`: validates jp/romaji/en as strings, trimmed, max 200 chars each
- `deletePhrase`: validates id as `parseInt`, `isInteger`, `> 0`
- React renders all JP/EN/romaji as text nodes (not innerHTML) — XSS safe by default
- Keyboard hotkeys (Ctrl+1-9) only call `botSends` — no eval/navigation/DOM

### CSS classes added (appended to App.css)
- `.suggestion-card`, `.suggestion-card-top`, `.suggestion-card-index`, `.suggestion-card-text`
- `.suggestion-card-jp`, `.suggestion-card-romaji`, `.suggestion-card-en`
- `.suggestion-save-btn`, `.suggestion-card-actions`
- `.suggest-btn`, `.suggest-btn--speaks`, `.suggest-btn--sends`, `.suggest-btn--speak`
- `.romaji-popup-overlay`, `.romaji-popup-card`, `.romaji-popup-label`
- `.romaji-popup-text`, `.romaji-popup-jp`, `.romaji-popup-close`, `.romaji-popup-esc`
- `.quick-reactions`, `.reaction-btn`
- `.phrasebook`, `.phrasebook-header`, `.phrasebook-icon`, `.phrasebook-title`
- `.phrasebook-count`, `.phrasebook-chevron`, `.phrasebook-list`
- `.phrase-row`, `.phrase-slot`, `.phrase-text`, `.phrase-jp`, `.phrase-romaji`
- `.phrase-actions`, `.phrase-btn`, `.phrase-btn--speak`, `.phrase-btn--send`, `.phrase-btn--delete`
- `.stats-panel`, `.stats-item`, `.stats-label`, `.stats-value`, `.stats-sep`
- `.stats-ws-open`, `.stats-ws-connecting`, `.stats-ws-closed`

### Day 4 priorities (May 7)
- Framer Motion card animations (spring polish)
- bot/tts.js — botSpeaks stub structure for Day 5
- Window snap-to-corner (double-click header)
- Record demo video footage (local pipeline — no cloud needed)
- Write README + HuggingFace Space demo page draft
- Keyboard shortcuts polish (Tab between suggestions, number keys 1/2/3 for suggestions)

---

## SESSION 8 — May 6, 2026 (Day 4 — UI Polish + README)

### What was done this session

#### App.tsx — 1/2/3 key shortcuts useEffect
- User asked: "should I add the 1/2/3 shortcuts useEffect before `// ── Bottom resize handle`?"
- **Answer confirmed: YES** — the blank lines between `sendCommand` useCallback and the resize handle comment are the correct insertion point
- Placement rationale: after `orderedSpeakers` and `sendCommand` are both defined; before window manipulation logic
- useEffect skips INPUT/TEXTAREA active elements, skips Ctrl/Alt/Meta (reserved for phrasebook Ctrl+1-9)
- Finds most recently updated speaker (`lastUpdated` field) that has a suggestion at the chosen index
- Calls `sendCommand({ action: "botSends", text: active.suggestions[idx].jp })`
- deps array: `[orderedSpeakers, sendCommand]`

#### README.md — OVERWRITTEN (STEP 7)
- Full professional README written with:
  - 7-step "What It Does" explanation + text sidechat mention
  - Architecture diagram (text ASCII) + two-pass translation explanation
  - Full tech stack table (14 rows)
  - Quick start guide (clone → .env → server → bot → overlay)
  - Keyboard shortcuts table (1/2/3, Ctrl+1-9, Escape, double-click header)
  - AMD Cloud setup commands (SSH, Docker, vLLM, SSH tunnel)
  - Project structure tree
  - Hackathon identity + prize tracks targeted
  - MIT license

#### Day 4 tasks guided (user implementing, not yet applied by agent)
- `src-tauri/capabilities/default.json` — add 3 position permissions:
  - `"core:window:allow-outer-position"`
  - `"core:window:allow-outer-size"`
  - `"core:window:allow-set-position"`
- `src/components/Header.tsx` — add `LogicalPosition` import, `handleSnapToCorner()` function, `onDoubleClick` on `.drag-handle`
- `src/components/SpeakerCard.tsx` — speaking className conditional, updated motion props (spring stiffness:390 damping:28, whileHover scale:1.005)
- `src/App.css` — append `@keyframes speaking-glow` + `.speaker-card.speaking` rule

### Current Day 4 status
| Task | Status |
|---|---|
| Card animation polish (Framer Motion spring) | ✅ Guided — user implementing |
| Snap-to-corner (double-click header) | ✅ Guided — user implementing |
| 1/2/3 key shortcuts useEffect | ✅ Guided + placement confirmed |
| README.md | ✅ DONE (written this session) |
| bot/tts.js stub | ⬜ Not started |
| hf-space/ folder + 2 files | ⬜ Not started |
| Demo video recording | ⬜ Not started |
| Git commit + push Day 4 | ⬜ Not started |

### Remaining Day 4 work (in recommended order)
1. `src-tauri/capabilities/default.json` — add 3 position permissions
2. `src/components/Header.tsx` — LogicalPosition import + handleSnapToCorner + onDoubleClick
3. `src/components/SpeakerCard.tsx` — speaking className + motion props polish
4. `src/App.css` — append speaking-glow keyframes
5. `src/App.tsx` — insert 1/2/3 shortcuts useEffect before `// ── Bottom resize handle`
6. `bot/tts.js` — create stub file
7. `hf-space/README.md` + `hf-space/index.html` — create both
8. Demo video recording
9. `git commit -m "Day 4: card animation polish, snap-to-corner, 1/2/3 shortcuts, tts.js stub, README, HF Space draft"`

### Day 5 plan (unchanged — May 8)
- Recreate AMD MI300X droplet (~$83 credit, $1.99/hr)
- Re-download Llama 3.3 70B (263GB, ~1-2hrs)
- SSH tunnel: `ssh -i "$HOME\.ssh\miwa_amd" -N -L 8765:localhost:8765 root@<new-ip>`
- WhisperX, Qdrant, CrewAI (suggest.py — CRITICAL for Track 1), XTTS v2
- Wire bot/tts.js with real XTTS endpoint

---

## SESSION 9 — May 6, 2026 (Day 4 — HF Space + Animated Pipeline + Day 4 Complete)

### All Day 4 tasks verified COMPLETE

| Task | Status | Evidence |
|---|---|---|
| README.md | ✅ | Full professional README with arch diagram, stack table, shortcuts, AMD commands |
| 1/2/3 key shortcuts | ✅ | App.tsx line 287 — `onKey` handler, `parseInt(e.key, 10) - 1` |
| Framer Motion spring animation | ✅ | SpeakerCard.tsx — `motion.div` + `AnimatePresence` at lines 54, 142–167 |
| Snap-to-corner (double-click) | ✅ | Header.tsx — `handleSnapToCorner()` + `onDoubleClick` at lines 83–134 |
| bot/tts.js stub | ✅ | `createTtsPlayer()` + `speak()` stub + Day 5 XTTS wiring commented in |
| hf-space/README.md | ✅ | HF YAML front matter: `sdk: static`, `title: Miwa 美話`, `emoji: 🎙️`, `pinned: true` |
| hf-space/index.html | ✅ | Full 7-section animated landing page (see below) |
| Git commit + push | ✅ | `git push origin main` exit code 0 |

### hf-space/index.html — full landing page (built this session)

**Libraries used:**
- Three.js 0.169.0 + postprocessing 6.36.4 via esm.sh import map — hyperspeed WebGL road animation
- React 19 + tech-stack-icons@3.7.1 via esm.sh — Stack section icons
- Vanilla JS IntersectionObserver for `.r` scroll-reveal (`.in` class, `data-d` delays)

**CSS variables:** `--muted`, `--muted2`, `--surface`, `--surface2`, `--border`, `--border2`, `--mono`, `--text`

**Section order (final, after reorder):**
1. Hero — hyperspeed WebGL canvas, headline, stats row, CTAs
2. `#demo` — faithful Miwa overlay replica (speaker card, karaoke, suggestions, quick reply)
3. `#pipeline` — animated pipeline diagram (see below)
4. `#amd` — MI300X hero banner + comparison table + 4 advantage cards
5. `#features` — 7-card bento grid
6. `#stack` — AMD featured card + 3 layer rows + tech-stack-icons
7. `#engineering` — solo build banner + visual arch diagram + 6 decision cards

**Pipeline section — animated diagram:**
- 6 stage nodes (🎤 📝 ⚡ 🧠 🤖 🪟) connected by thin lines
- Active node glows blue, passed nodes glow green, connectors fill left→right
- Flowing track: 22 random Japanese kanji particles (今日ゲーム楽しかった...) animating left→right at varied speeds/colors/heights
- Blue packet bubble transitions between stage positions (0.7s cubic-bezier)
- Packet label changes per stage: `♪ PCM` → `日本語→` → `fast→EN` → `refined→` → `提案×3` → `✓ done`
- Terminal output panel with macOS-style dots:
  - IN: instant display of what enters the stage
  - OUT: typewriter effect — JP at 14ms/char, EN at 18ms/char
  - Badge color: green = fast stage, blue = slow/LLM stage
- Starts via IntersectionObserver at 25% visibility, loops infinitely
- JS IIFE script added as separate `<script>` block before `</body>`

**Demo section — faithful Miwa overlay replica:**
- Header with drag dots, Miwa brand, style pills (Formal/Neutral/Casual/Gaming), mini button
- Speaker card: discord avatar (circle), name, 🎙️, speaking pulse dot
- JP karaoke text with word highlighted
- Romaji line below JP
- EN translation with GT → AI badge
- 3 suggestion chips (collapsed by default with expand toggle)
- Resize nub at bottom

**Key decisions made this session:**
- Section reorder done via PowerShell `[System.IO.File]::WriteAllText` (bypasses VS Code file lock that blocked `Set-Content`)
- Nav links and hero CTA updated to match new section order
- Font sizes bumped from 9-11px → 11-15px; opacity from 28% → 60-85% for readability
- Demo overlay CSS reads actual design tokens from `src/App.css` (--bg, --accent, --green, --amber)

### Current state heading into Day 5 (May 8)

| Component | Status |
|---|---|
| AMD MI300X instance | ❌ DESTROYED — recreate Day 5 (May 8) |
| Llama 3.3 70B | ❌ Was on destroyed droplet — must re-download |
| vLLM serving | ❌ Destroyed with droplet |
| All local code (Days 1-4) | ✅ 100% complete |
| hf-space/ (HF demo page) | ✅ Complete — 7 animated sections |
| Git repo | ✅ Pushed — github.com/Mizunandayo/miwa |
| WhisperX | ❌ Day 5 |
| Qdrant | ❌ Day 5 |
| CrewAI / suggest.py | ❌ Day 5 (CRITICAL for Track 1) |
| XTTS v2 | ❌ Day 5 |
| Demo video recording | ⬜ Still pending (any day — no cloud needed) |

---

## SESSION 10 — May 7, 2026 (Day 5 — Non-Cloud Module Wiring)

### Strategy
Write all 4 Python modules locally (no GPU needed) → git push → on cloud just `git pull` + `pip install`. Saves ~2hrs of billing on cloud.

### New files created

#### `server/transcribe.py`
- Input: raw int16 PCM bytes (16kHz mono) from Discord
- Output: `{ "text": str, "words": [{ "word", "start", "end" }] }`
- Lazy-loads WhisperX: `load_model(large-v3, cuda, float16)` + `load_align_model(ja)`
- `_pcm_to_float32()` converts raw bytes → numpy float32 via `struct.unpack`
- Caps at 30s of audio (30*16000*2 bytes) — prevents memory exhaustion
- Falls back to stub `{ "text": "おはようございます", words: [...] }` if whisperx not installed

#### `server/memory.py`
- Qdrant collection: `miwa_memory`, vector size 384 (MiniLM-L12-v2 cosine)
- `store(user_id, jp, en, style)` → upsert with UUID point ID
- `recall(user_id, query, top_k=5)` → filter by userId, cosine search
- Both lazy-load: QdrantClient + SentenceTransformer on first call
- Cap: top_k capped at 10 regardless of caller; input text capped at 500 chars

#### `server/suggest.py`
- 3-tier fallback: CrewAI → direct vLLM REST → static pool
- CrewAI agents: Analyst (context reader) → Strategist (picks 3 intents) → Writer (JP replies)
- LLM: `LLM(model=f"openai/{VLLM_MODEL}", base_url=VLLM_URL, api_key="not-required")`
- Direct vLLM: POST to `{VLLM_URL}/chat/completions`, regex-extract JSON, validate structure
- `_STYLE_DESCRIPTIONS` dict maps formal/neutral/casual/gaming → natural language description for prompt
- Output always exactly 3 `{ jp, romaji, en }` dicts — padded with fallback pool if needed
- Security: all string fields trimmed + sliced to 200 chars before returning

#### `server/tts.py`
- `synthesize(text)` → returns raw WAV bytes or None
- XTTS v2 via `TTS(TTS_MODEL).to(TTS_DEVICE)`
- Converts numpy float32 output → wave.open() → int16 → bytes
- Sample rate: 22050Hz (XTTS native), 1 channel, 16-bit
- Text capped at 200 chars; response size capped at 10MB in main.py

### `server/main.py` changes
1. Added imports: `from transcribe import transcribe`, `from memory import store/recall`, `from suggest import get_suggestions`, `from tts import synthesize`
2. Added `TtsRequest(BaseModel)` + `POST /tts` endpoint (returns `audio/wav` Response)
3. Audio path: `transcribe_stub()` → `transcribe(audio_bytes)` → extracts `text` + `whisper_words`
4. After Google Translate fast packet: `run_in_executor` calls for `memory_store()` + `memory_recall()` + `get_suggestions()`
5. Refined packet now uses real `suggestions` from suggest.py instead of `pick_suggestions()`

### `bot/tts.js` changes
- Uncommented the real XTTS wiring block
- `fetch(`${serverUrl}/tts`, POST, JSON, AbortSignal.timeout(8000))`
- `res.arrayBuffer()` → `Readable.from(Buffer.from(...))` → `createAudioResource(stream, {inputType: StreamType.Arbitrary})`
- Added empty WAV guard (`byteLength === 0`)
- Removed stub console.log

### `requirements.txt` additions
- `openai==1.77.0` (local-safe — used by CrewAI LLM client for vLLM compat)
- Cloud-only (commented out): `whisperx`, `qdrant-client==1.12.2`, `sentence-transformers==3.3.1`, `crewai==0.95.0`, `TTS==0.22.0`

### `.env` additions
```
VLLM_URL=http://localhost:8000/v1
VLLM_MODEL=/app/models/llama3.3-70b
WHISPERX_DEVICE=cuda
WHISPERX_MODEL=large-v3
TTS_DEVICE=cuda
TTS_SPEAKER=Claribel Dervla
QDRANT_URL=http://localhost:6333
EMBED_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

### Security decisions
- All user input trimmed + length-capped at module boundaries (not just main.py)
- CrewAI LLM api_key set to "not-required" — vLLM doesn't auth
- /tts endpoint response capped at 10MB
- Qdrant filter strictly by userId — no cross-speaker data leakage
- whisper_words from transcribe — audio bytes never logged

### Architecture: why run_in_executor for suggest/memory
CrewAI and Qdrant are blocking (sync) libraries. Using `asyncio.get_event_loop().run_in_executor(None, lambda: ...)` runs them in a thread pool without blocking the FastAPI async WebSocket loop. This keeps the fast packet (<100ms) unaffected by the slow agent pipeline (~2-3s).

### Day 5 cloud checklist (when AMD instance is running)
```bash
# 1. SSH in
ssh -i "$HOME\.ssh\miwa_amd" -o StrictHostKeyChecking=no root@<new-ip>

# 2. Enter container
docker exec -it rocm /bin/bash

# 3. Git pull latest code
cd /app && git pull origin main

# 4. Re-download model (if new droplet)
huggingface-cli download meta-llama/Llama-3.3-70B-Instruct \
  --local-dir /app/models/llama3.3-70b --token $HF_TOKEN

# 5. Start vLLM
nohup vllm serve /app/models/llama3.3-70b --host 0.0.0.0 --port 8000 --max-model-len 8192 > /app/vllm.log 2>&1 &

# 6. Start Qdrant
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# 7. Uncomment cloud deps in requirements.txt, then:
pip install -r server/requirements.txt

# 8. Start Miwa server
cd server && python main.py

# 9. SSH tunnel (run locally in PowerShell)
ssh -i "$HOME\.ssh\miwa_amd" -N -L 8765:localhost:8765 root@<new-ip>
```

### Current status after Session 10
| Component | Status |
|---|---|
| server/transcribe.py | ✅ Written locally |
| server/memory.py | ✅ Written locally |
| server/suggest.py | ✅ Written locally |
| server/tts.py | ✅ Written locally |
| server/main.py (wired) | ✅ Updated |
| bot/tts.js (real wiring) | ✅ Uncommented |
| requirements.txt | ✅ Updated |
| .env | ✅ Day 5 keys added |
| AMD MI300X | ❌ Not yet created |
| Model download | ❌ Not yet |
| End-to-end cloud test | ❌ Not yet |

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

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

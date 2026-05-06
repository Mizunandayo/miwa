/**
 * bot/index.js — Miwa Discord Bot
 *
 * Responsibilities:
 * 1. Join voice channels and capture per-user audio (Opus → PCM)
 * 2. Capture text messages typed in the voice channel's text chat
 * 3. Forward audio/text to server/main.py (port 8765) for translation
 * 4. Serve translated packets to Tauri React UI (port 8766)
 * 5. Cache Discord avatars in SQLite
 * 6. Handle delivery commands from UI (botSends)
 *
 * Security:
 * - UI WS server bound to 127.0.0.1 only
 * - Checks remoteAddress on each UI WS connection
 * - Audio capped at 2MB before sending
 * - Text sanitized of mentions/channel tags before forwarding
 * - Required env vars validated at startup (fail fast)
 */

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType,
  getVoiceConnection,
} from "@discordjs/voice";
import prism from "prism-media";
import { WebSocket, WebSocketServer } from "ws";
import https from "https";
import sharp from "sharp";
import { initDb, getCachedAvatar, saveAvatar } from "./db.js";

// ─── Startup validation ────────────────────────────────────────────────────
const REQUIRED_ENV = ["DISCORD_TOKEN"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[bot] FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SERVER_WS_URL = process.env.AMD_SERVER_WS_URL || "ws://127.0.0.1:8765/ws";
const UI_WS_PORT = parseInt(process.env.UI_WS_PORT || "8766", 10);
const DEFAULT_STYLE = process.env.DEFAULT_STYLE || "casual";
const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB

// ─── State ─────────────────────────────────────────────────────────────────
let serverWs = null;
let currentVoiceChannelId = null;
let currentGuildId = null;
let styleMode = DEFAULT_STYLE;
let cachedGuildIconB64 = null;
let cachedGuildIconForId = null; // guild ID the icon was fetched for

/**
 * speakerCache — maps userId → { username, avatarB64, source }
 * Server doesn't return these fields, so we merge locally when
 * forwarding the translated packet to the UI.
 */
const speakerCache = new Map();

// ─── Init DB ───────────────────────────────────────────────────────────────
initDb();






// ─── Discord Client ────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});






// ─── UI WebSocket Server (port 8766) ───────────────────────────────────────
// Serves the Tauri React overlay — localhost only, never exposed externally.
const uiWss = new WebSocketServer({ host: "127.0.0.1", port: UI_WS_PORT });
const uiClients = new Set();

uiWss.on("connection", (ws, req) => {
  // Enforce localhost-only
  const ip = req.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
    console.warn(`[ui-ws] Rejected connection from ${ip}`);
    ws.close();
    return;
  }

  uiClients.add(ws);
  console.log(`[ui-ws] React UI connected (total: ${uiClients.size})`);

  // Send current call state immediately so overlay is up-to-date on reconnect
  setTimeout(() => broadcastCallInfo(), 200);

  ws.on("message", (data) => {
    // Commands FROM the UI: setStyle, botSends, etc.
    try {
      const msg = JSON.parse(data.toString());
      handleUiCommand(msg);
    } catch {
      /* ignore malformed */
    }
  });

  ws.on("close", () => {
    uiClients.delete(ws);
    console.log(`[ui-ws] React UI disconnected (total: ${uiClients.size})`);
  });

  ws.on("error", () => uiClients.delete(ws));
});

function broadcastToUI(data) {
  const json = JSON.stringify(data);
  for (const ws of uiClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

async function broadcastCallInfo() {
  if (!currentGuildId || !currentVoiceChannelId) return;
  const guild = client.guilds.cache.get(currentGuildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(currentVoiceChannelId);
  if (!channel) return;

  // Fetch guild icon once per guild session
  if (cachedGuildIconForId !== currentGuildId) {
    cachedGuildIconForId = currentGuildId;
    cachedGuildIconB64 = await fetchGuildIconBase64(guild.id, guild.icon);
  }

  // Fetch avatars for all VC members in parallel (even those who haven't spoken)
  const memberPromises = [];
  for (const [memberId, member] of channel.members) {
    if (member.user.bot) continue;
    memberPromises.push((async () => {
      const cached = speakerCache.get(memberId);
      let avatarB64 = cached?.avatarB64 ?? null;
      if (!avatarB64) {
        avatarB64 = await fetchAvatarBase64(memberId, member.user.avatar);
        if (avatarB64) {
          const username = member.displayName || member.user.username;
          saveAvatar(memberId, username, avatarB64);
          speakerCache.set(memberId, { username, avatarB64, source: cached?.source ?? "unknown" });
        }
      }
      return {
        userId: memberId,
        username: member.displayName || member.user.username,
        avatarB64,
      };
    })());
  }
  const members = await Promise.all(memberPromises);

  broadcastToUI({
    type: "call_info",
    guildName: guild.name,
    guildIconB64: cachedGuildIconB64,
    channelName: channel.name,
    members,
  });
}





// ─── Server WebSocket Client (port 8765) ───────────────────────────────────
// Connects to server/main.py. Reconnects automatically if server is down.
function connectToServer() {
  if (
    serverWs &&
    [WebSocket.OPEN, WebSocket.CONNECTING].includes(serverWs.readyState)
  ) {
    return;
  }

  console.log(`[server-ws] Connecting to ${SERVER_WS_URL}…`);
  serverWs = new WebSocket(SERVER_WS_URL);

  serverWs.on("open", () => {
    console.log("[server-ws] Connected to translation server");
  });

  serverWs.on("message", (rawData) => {
    try {
      const packet = JSON.parse(rawData.toString());

      // Enrich packet with speaker info the server doesn't store
      if (packet.userId && speakerCache.has(packet.userId)) {
        const cached = speakerCache.get(packet.userId);
        packet.username = cached.username;
        packet.avatarB64 = cached.avatarB64;
        packet.source = cached.source;
      }

      broadcastToUI(packet);
    } catch {
      /* ignore */
    }
  });

  serverWs.on("error", (err) => {
    console.warn("[server-ws] Error:", err.message);
  });

  serverWs.on("close", () => {
    console.log("[server-ws] Disconnected — reconnecting in 3s…");
    setTimeout(connectToServer, 3000);
  });
}

function sendToServer(payload) {
  if (!serverWs || serverWs.readyState !== WebSocket.OPEN) {
    console.warn("[server-ws] Not connected — dropping packet");
    return;
  }
  serverWs.send(JSON.stringify(payload));
}





// ─── Avatar Fetching ───────────────────────────────────────────────────────
async function fetchAvatarBase64(userId, avatarHash) {
  // Check cache first
  const cached = getCachedAvatar(userId);
  if (cached) return cached;

  if (!avatarHash) return null;

  return new Promise((resolve) => {
    const url = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        try {
          const buf = Buffer.concat(chunks);
          // Resize to 64×64 — keeps base64 payload small
          const resized = await sharp(buf).resize(64, 64).png().toBuffer();
          resolve(`data:image/png;base64,${resized.toString("base64")}`);
        } catch {
          resolve(null);
        }
      });
      res.on("error", () => resolve(null));
    });
  });
}






async function fetchGuildIconBase64(guildId, iconHash) {
  if (!iconHash) return null;
  return new Promise((resolve) => {
    const url = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=64`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        try {
          const buf = Buffer.concat(chunks);
          const resized = await sharp(buf).resize(64, 64).png().toBuffer();
          resolve(`data:image/png;base64,${resized.toString("base64")}`);
        } catch { resolve(null); }
      });
      res.on("error", () => resolve(null));
    });
  });
}

// ─── Voice Audio Pipeline ──────────────────────────────────────────────────
function attachVoiceReceiver(connection) {
  const receiver = connection.receiver;

  receiver.speaking.on("start", async (userId) => {
    // Avoid duplicate subscriptions if already recording this user
    if (receiver.subscriptions.has(userId)) return;

    const audioStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 200, // 200ms of silence marks end of utterance
      },
    });

    // Decode Opus → PCM at 16kHz mono (WhisperX input format)
    const pcmStream = audioStream.pipe(
      new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 960 })
    );

    const chunks = [];
    let totalBytes = 0;

    pcmStream.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes <= MAX_AUDIO_BYTES) chunks.push(chunk);
    });

    pcmStream.on("end", async () => {
      if (chunks.length === 0) return;

      const pcmBuffer = Buffer.concat(chunks);
      const guild = client.guilds.cache.get(currentGuildId);
      const member = guild?.members.cache.get(userId);
      const user = member?.user;
      const username =
        member?.displayName || user?.username || userId;

      // Fetch and cache avatar
      let avatarB64 = null;
      if (user) {
        avatarB64 = await fetchAvatarBase64(userId, user.avatar);
        if (avatarB64) saveAvatar(userId, username, avatarB64);
      }

      // Store in speaker cache so server response can be enriched
      speakerCache.set(userId, { username, avatarB64, source: "voice" });

      sendToServer({
        type: "audio",
        userId,
        username,
        avatarB64,
        audio: pcmBuffer.toString("base64"),
        style: styleMode,
        source: "voice",
      });

      console.log(
        `[bot] Audio → server: ${username} (${pcmBuffer.length} bytes PCM)`
      );
    });

    pcmStream.on("error", (err) => {
      console.error(`[bot] PCM stream error for ${userId}:`, err.message);
    });
  });
}






// ─── Voice Channel Text Chat ───────────────────────────────────────────────
// Captures messages typed in the voice channel's text tab.
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!currentVoiceChannelId) return;
  // Only capture from the watched VC's text channel
  if (message.channelId !== currentVoiceChannelId) return;
  // Don't process bot commands
  if (message.content.startsWith("!")) return;

  // Only translate messages containing Japanese characters
  const hasJapanese = /[\u3000-\u9fff\uff00-\uffef]/.test(message.content);
  if (!hasJapanese) return;

  // Sanitize: remove mentions and channel references, keep Japanese text
  const cleanText = message.content
    .replace(/<@!?\d+>/g, "")  // user mentions
    .replace(/<#\d+>/g, "")   // channel mentions
    .replace(/<:\w+:\d+>/g, "") // custom emoji
    .trim();

  if (!cleanText || cleanText.length > 500) return;

  const userId = message.author.id;
  const username =
    message.member?.displayName || message.author.username;

  // Fetch and cache avatar
  let avatarB64 = getCachedAvatar(userId);
  if (!avatarB64 && message.author.avatar) {
    avatarB64 = await fetchAvatarBase64(userId, message.author.avatar);
    if (avatarB64) saveAvatar(userId, username, avatarB64);
  }

  speakerCache.set(userId, { username, avatarB64, source: "text_chat" });

  sendToServer({
    type: "text",
    userId,
    username,
    avatarB64,
    text: cleanText,
    style: styleMode,
    source: "text_chat",
  });

  console.log(`[bot] Text chat → server: ${username}: ${cleanText}`);
});






// ─── Commands from UI ──────────────────────────────────────────────────────
function handleUiCommand(msg) {
  if (!msg.action) return;

  if (msg.action === "setStyle") {
    styleMode = msg.style || DEFAULT_STYLE;
    console.log(`[bot] Style → ${styleMode}`);
  }

  if (msg.action === "quickReply" && msg.text) {
    // Forward EN text to server for EN→JP translation
    sendToServer({
      type: "quick_reply",
      text: msg.text,
      style: styleMode,
    });
  }

  if (msg.action === "refreshSuggestions" && msg.userId) {
    // Request fresh suggestions for a specific speaker
    sendToServer({
      type: "refresh_suggestions",
      userId: msg.userId,
      style: styleMode,
    });
  }

  if (msg.action === "botSends" && currentGuildId && msg.text) {
    // Bot types Japanese into the voice channel text chat
    const guild = client.guilds.cache.get(currentGuildId);
    const channel = guild?.channels.cache.get(currentVoiceChannelId);
    channel?.send(msg.text).catch((err) => {
      console.error("[bot] botSends failed:", err.message);
    });
  }

  // botSpeaks (XTTS v2 TTS) → Day 5
}








// ─── !join / !leave commands ───────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!join") {
    const member = message.guild.members.cache.get(message.author.id);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      message.reply("You need to be in a voice channel first.").catch(() => {});
      return;
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,  // Must be false to receive audio
        selfMute: true,
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        currentVoiceChannelId = voiceChannel.id;
        currentGuildId = voiceChannel.guild.id;
        console.log(`[bot] Joined: ${voiceChannel.name}`);

        broadcastToUI({
          type: "status",
          event: "joined",
          channelName: voiceChannel.name,
        });

        // Broadcast full call info
        broadcastCallInfo();

        attachVoiceReceiver(connection);
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        currentVoiceChannelId = null;
        currentGuildId = null;
        broadcastToUI({ type: "status", event: "left" });
        broadcastToUI({ type: "call_info", guildName: "", channelName: "", members: [] });
      });

      message
        .reply(`Joined **${voiceChannel.name}** — Miwa is listening 🎙️`)
        .catch(() => {});
    } catch (err) {
      console.error("[bot] Join failed:", err);
      message.reply("Failed to join voice channel.").catch(() => {});
    }
  }

  if (message.content === "!leave") {
    if (!currentGuildId) return;
    const connection = getVoiceConnection(currentGuildId);
    if (connection) {
      connection.destroy();
      currentVoiceChannelId = null;
      currentGuildId = null;
      broadcastToUI({ type: "status", event: "left" });
      message.reply("Left the voice channel. 👋").catch(() => {});
    }
  }
});



// ─── Bot Ready ─────────────────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);
  console.log(`[bot] UI WebSocket → ws://127.0.0.1:${UI_WS_PORT}`);
  connectToServer();
  broadcastToUI({ type: "status", event: "ready", tag: client.user.tag });
});



// ─── Graceful Shutdown ─────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("[bot] Shutting down…");
  if (currentGuildId) {
    getVoiceConnection(currentGuildId)?.destroy();
  }
  serverWs?.close();
  uiWss.close();
  process.exit(0);
});

// ─── Start ─────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
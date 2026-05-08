/**
 * bot/tts.js — edge-tts delivery (Microsoft Neural TTS)
 *
 * Wiring:
 * 1. POST japanese text to server/tts.py → returns MP3 bytes (edge-tts)
 * 2. Convert bytes to Readable stream
 * 3. Wrap in AudioResource via @discordjs/voice
 * 4. Play on the guild's AudioPlayer
 *
 * Until Day 5, speak() logs and returns — no audio plays.
 */

import {
  createAudioPlayer,
  createAudioResource,
  StreamType,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { Readable } from "stream";

// --- AudioPlayer factory ---

/**
 * Create a persistent AudioPlayer for a guild.
 * Call once on !join, keep alive for the session.
 * Subscribe it to the VoiceConnection via connection.subscribe(player).
 *
 * @returns {import("@discordjs/voice").AudioPlayer}
 */
export function createTtsPlayer() {
  return createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });
}


// ── Pre-synthesis cache ───────────────────────────────────────────────────────
// When suggestions arrive the bot calls prefetch() for each JP text so that
// "Bot Speaks" click → ~0 ms (cache hit) instead of ~1.5 s (full synthesis).
const ttsCache = new Map(); // text → Buffer
const TTS_CACHE_MAX = 50;

/**
 * Pre-fetch TTS audio for a JP text and store it in the in-memory cache.
 * Non-blocking — call and forget; errors are silently swallowed.
 *
 * @param {string} text        - Japanese text
 * @param {string} [serverUrl] - TTS server base URL
 */
export async function prefetch(text, serverUrl = "http://127.0.0.1:8765") {
  const key = String(text || "").trim().slice(0, 200);
  if (!key || ttsCache.has(key)) return;
  try {
    const res = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: key }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return;
    if (ttsCache.size >= TTS_CACHE_MAX) {
      ttsCache.delete(ttsCache.keys().next().value); // evict oldest
    }
    ttsCache.set(key, buf);
    console.log(`[tts] prefetched "${key.slice(0, 28)}" (${buf.byteLength}B)`);
  } catch {
    // Non-fatal — cache miss will stream at click time
  }
}







// --- TTS speak ------

/**
 * Synthesize Japanese text and play it in the voice channel.
 *
 * Fast path (cache hit)  — plays from memory in ~0 ms.
 * Slow path (cache miss) — streams from server; playback starts on first
 *                          chunk (~300 ms) instead of waiting for full audio.
 *
 * @param {string} text          - Japanese text to synthesize (max 200 chars)
 * @param {import("@discordjs/voice").AudioPlayer} player - Guild audio player
 * @param {string} [serverUrl]   - TTS server base URL (default: localhost:8765)
 */
export async function speak(
  text,
  player,
  serverUrl = "http://127.0.0.1:8765"
) {
  if (!text || !player) {
    console.warn("[tts] speak() called with missing args — skipping");
    return;
  }

  const safeText = String(text).trim().slice(0, 200);
  if (!safeText) return;

  try {
    // ── Cache hit: play immediately from memory (~0 ms) ─────────────────────
    const cached = ttsCache.get(safeText);
    if (cached) {
      console.log(`[tts] cache hit "${safeText.slice(0, 28)}" (${cached.byteLength}B)`);
      ttsCache.delete(safeText); // single-use — free memory after playing
      const stream = Readable.from(cached);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      player.play(resource);
      return;
    }

    // ── Cache miss: stream from server (first byte ~300 ms) ─────────────────
    // Pipe the response body stream directly to Discord — no full-buffer wait.
    const res = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: safeText }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`[tts] Server error ${res.status}: ${await res.text()}`);
      return;
    }

    // Readable.fromWeb converts the Web Streams body to a Node.js Readable.
    // Discord's AudioPlayer starts playing as soon as the first frames arrive.
    const nodeStream = Readable.fromWeb(res.body);
    const resource = createAudioResource(nodeStream, { inputType: StreamType.Arbitrary });
    player.play(resource);
    console.log(`[tts] streaming: "${safeText.slice(0, 28)}"`);
  } catch (err) {
    console.error("[tts] speak() failed:", err.message);
  }
}
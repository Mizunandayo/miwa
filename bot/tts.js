/**
 * bot/tts.js — XTTS v2 TTS delivery stub
 *
 * Day 5 wiring plan:
 * 1. POST japanese text to server/tts.py → returns raw WAV bytes
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









// --- TTS speak ------

/**
 * Synthesize Japanese text and play it in the voice channel.
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
  // Input validation — never trust caller
  if (!text || !player) {
    console.warn("[tts] speak() called with missing args — skipping");
    return;
  }

  const safeText = String(text).trim().slice(0, 200);
  if (!safeText) return;





  try {
    const res = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: safeText }),
      signal: AbortSignal.timeout(8000), // 8s — fail fast
    });

    if (!res.ok) {
      console.error(`[tts] Server error ${res.status}: ${await res.text()}`);
      return;
    }

    const wavBuffer = await res.arrayBuffer();
    if (wavBuffer.byteLength === 0) {
      console.warn("[tts] Empty WAV received — skipping");
      return;
    }

    const stream = Readable.from(Buffer.from(wavBuffer));
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });
    player.play(resource);
    console.log(`[tts] Playing: "${safeText}"`);
  } catch (err) {
    console.error("[tts] speak() failed:", err.message);
  }
}
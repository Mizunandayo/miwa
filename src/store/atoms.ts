/**
 * src/store/atoms.ts — Jotai atomic state for Miwa overlay
 *
 * Why Jotai:
 * - Atomic state means each component subscribes only to what it uses
 * - No unnecessary re-renders (SpeakerCard doesn't re-render when opacity changes)
 * - derived atoms (orderedSpeakersAtom) compute automatically
 */

import { atom } from "jotai";

// ─── Types ─────────────────────────────────────────────────────────────────

export type StyleMode = "formal" | "neutral" | "casual" | "gaming";
export type TranslationSource = "google" | "llm";
export type MessageSource = "voice" | "text_chat";
export type BotStatus = "disconnected" | "connecting" | "connected" | "joined";

export interface WordToken {
  word: string;
  romaji: string;
  index: number;
}

export interface Suggestion {
  jp: string;
  romaji: string;
  en: string;
}

export interface SpeakerState {
  userId: string;
  username: string;
  avatarB64: string | null;
  jp: string;
  en: string;
  romaji: string;
  words: WordToken[];
  suggestions: Suggestion[];
  translationSource: TranslationSource;
  source: MessageSource;
  isSpeaking: boolean;
  lastUpdated: number;
}

export interface StatsState {
  latencyMs: number;
  lastUpdated: number;
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

/** Active speakers keyed by userId */
export const speakersAtom = atom<Map<string, SpeakerState>>(new Map());

/** Ordered list of speaker IDs — insertion order = card order */
export const speakerOrderAtom = atom<string[]>([]);

/**
 * Derived: ordered SpeakerState array for rendering.
 * Recomputes only when speakersAtom or speakerOrderAtom change.
 */
export const orderedSpeakersAtom = atom((get) => {
  const speakers = get(speakersAtom);
  const order = get(speakerOrderAtom);
  return order
    .map((id) => speakers.get(id))
    .filter((s): s is SpeakerState => s !== undefined);
});

/** Currently selected style mode */
export const styleModeAtom = atom<StyleMode>("casual");

/** Window opacity as percentage (40–100) */
export const opacityAtom = atom<number>(90);

/** Compact single-line view */
export const isMiniModeAtom = atom<boolean>(false);

/** Mouse events pass through overlay to game */
export const isClickThroughAtom = atom<boolean>(false);

/** Bot connection status */
export const botStatusAtom = atom<BotStatus>("disconnected");

/** Name of currently joined voice channel */
export const channelNameAtom = atom<string>("");

/** Latency stats for the StatsPanel */
export const statsAtom = atom<StatsState>({ latencyMs: 0, lastUpdated: 0 });

/** WebSocket connection to bot */
export const wsStatusAtom = atom<"connecting" | "open" | "closed">("closed");
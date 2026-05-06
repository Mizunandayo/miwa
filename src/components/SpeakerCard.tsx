/**
 * src/components/SpeakerCard.tsx
 *
 * Displays one speaker (voice or text chat).
 * - Voice cards: KaraokeText + speaking pulse dot
 * - Text chat cards: plain JP text + 💬 icon (no karaoke, no speaking dot)
 * - Framer Motion spring physics for enter/exit
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SpeakerState } from "../store/atoms";
import KaraokeText from "./KaraokeText";
import RomajiLine from "./RomajiLine";

interface SpeakerCardProps {
  speaker: SpeakerState;
  sendCommand: (data: unknown) => void;
}

export default function SpeakerCard({ speaker, sendCommand }: SpeakerCardProps) {
  const {
    userId,
    username,
    avatarB64,
    jp,
    en,
    romaji,
    words,
    suggestions,
    translationSource,
    source,
    isSpeaking,
  } = speaker;

  const isVoice = source === "voice";
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    sendCommand({ action: "refreshSuggestions", userId });
    // Clear spinner after 1.5s max (server will update via WS)
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <motion.div
      className="speaker-card"
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.95  }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      {/* ── Card header ─────────────────────────────────────────────────── */}
      <div className="card-header">
        <div className="avatar-wrap">
          {avatarB64 ? (
            <img
              src={avatarB64}
              alt={username}
              className="avatar"
              draggable={false}
            />
          ) : (
            <div className="avatar-placeholder" aria-label={username}>
              {username.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Speaking pulse only on voice messages while actively speaking */}
          {isSpeaking && isVoice && <span className="speaking-dot" />}
        </div>

        <div className="card-meta">
          <span className="username">{username}</span>
          <span
            className="source-icon"
            title={isVoice ? "Voice" : "Text chat"}
          >
            {isVoice ? "🎙️" : "💬"}
          </span>
        </div>

        <span className={`badge ${translationSource === "google" ? "badge-gt" : "badge-ai"}`}>
          {translationSource === "google" ? "GT" : "AI"}
        </span>
      </div>

      {/* ── Card body ───────────────────────────────────────────────────── */}
      <div className="card-body">
        {/* Voice: karaoke animated words. Text chat: plain JP text */}
        {isVoice && words.length > 0 ? (
          <KaraokeText words={words} isSpeaking={isSpeaking} />
        ) : (
          <p className="jp-text">{jp}</p>
        )}

        <RomajiLine romaji={romaji} />
        <p className="en-text">{en}</p>
      </div>

      {/* ── Suggestions (appear after refined packet) ───────────────────── */}
      {suggestions.length > 0 && (
        <div className="suggestions">
          <div className="suggestions-header">
            <p className="suggestions-label">Reply with</p>
            <div className="suggestions-actions">
              <button
                className={`suggestions-refresh${refreshing ? " spinning" : ""}`}
                onClick={handleRefresh}
                title="Get new suggestions"
                disabled={refreshing}
              >
                ↻
              </button>
              <button
                className="suggestions-toggle"
                onClick={() => setSuggestionsOpen((v) => !v)}
                title={suggestionsOpen ? "Collapse" : "Expand"}
              >
                {suggestionsOpen ? "▾" : "▸"}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {suggestionsOpen && (
              <motion.div
                key="chips"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="suggestion-chips">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="suggestion-chip"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="suggestion-left">
                        <span className="suggestion-jp">{s.jp}</span>
                        <span className="suggestion-en">{s.en}</span>
                      </div>
                      <span className="suggestion-romaji">{s.romaji}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
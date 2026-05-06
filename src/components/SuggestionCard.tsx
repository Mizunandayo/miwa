/**
 * src/components/SuggestionCard.tsx
 *
 * Renders one AI reply suggestion with 3 delivery buttons:
 * - 🔊 Bot Speaks  → XTTS v2 stub (Day 5 cloud)
 * - 💬 Bot Sends   → bot types in Discord text channel
 * - 🗣 I'll Speak  → opens RomajiPopup fullscreen
 * - 📌 Save        → adds to phrasebook (Ctrl+1–9 hotkeys)
 */





import { motion } from "framer-motion";
import { useSetAtom } from "jotai";
import { romajiPopupAtom } from "../store/atoms";
import type { Suggestion } from "../store/atoms";

interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number; // 0-based — displayed as 1/2/3
  sendCommand: (data: unknown) => void;
}








export default function SuggestionCard({
  suggestion,
  index,
  sendCommand,
}: SuggestionCardProps) {
  const setRomajiPopup = useSetAtom(romajiPopupAtom);




  const handleBotSpeaks = () => {
    // Stub — XTTS v2 wired on Day 5
    sendCommand({ action: "botSpeaks", text: suggestion.jp });
  };




  const handleBotSends = () => {
    sendCommand({ action: "botSends", text: suggestion.jp });
  };



  const handleIllSpeak = () => {
    setRomajiPopup({ jp: suggestion.jp, romaji: suggestion.romaji });
  };




  const handleSave = () => {
    sendCommand({
      action: "savePhrase",
      jp: suggestion.jp,
      romaji: suggestion.romaji,
      en: suggestion.en,
    });
  };






  return (
    <motion.div
      className="suggestion-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.15 }}
    >
      {/* --- Text content --- */}
      <div className="suggestion-card-top">
        <span className="suggestion-card-index">{index + 1}</span>
        <div className="suggestion-card-text">
          <span className="suggestion-card-jp">{suggestion.jp}</span>
          <span className="suggestion-card-romaji">{suggestion.romaji}</span>
          <span className="suggestion-card-en">{suggestion.en}</span>
        </div>
        <button
          className="suggestion-save-btn"
          onClick={handleSave}
          title="Save to phrasebook (Ctrl+1–9)"
        >
          📌
        </button>
      </div>

      {/* --- Delivery buttons --- */}
      <div className="suggestion-card-actions">
        <button
          className="suggest-btn suggest-btn--speaks"
          onClick={handleBotSpeaks}
          title="Bot speaks in voice channel (Day 5)"
        >
          🔊 Bot Speaks
        </button>
        <button
          className="suggest-btn suggest-btn--sends"
          onClick={handleBotSends}
          title="Bot sends to text channel"
        >
          💬 Bot Sends
        </button>
        <button
          className="suggest-btn suggest-btn--speak"
          onClick={handleIllSpeak}
          title="Show romaji — read it yourself"
        >
          🗣 I'll Speak
        </button>
      </div>
    </motion.div>
  );
}
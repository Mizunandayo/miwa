/**
 * src/components/KaraokeText.tsx
 *
 * Word-by-word highlight animation.
 *
 * Day 2: Highlights the last word while isSpeaking=true (good enough placeholder)
 * Day 5: When WhisperX returns real word timestamps, drive highlight
 *         with a useEffect timer based on word.start_time offsets.
 */

import { motion } from "framer-motion";
import type { WordToken } from "../store/atoms";

interface KaraokeTextProps {
  words: WordToken[];
  isSpeaking: boolean;
}

export default function KaraokeText({ words, isSpeaking }: KaraokeTextProps) {
  return (
    <p className="jp-text karaoke">
      {words.map((w, i) => {
        // Highlight the last word while speaking — placeholder until WhisperX timestamps
        const isHighlighted = isSpeaking && i === words.length - 1;

        return (
          <motion.span
            key={`${w.word}-${i}`}
            className="karaoke-word"
            animate={{
              color: isHighlighted
                ? "rgba(255,255,255,1)"
                : "rgba(255,255,255,0.65)",
            }}
            transition={{ duration: 0.18 }}
          >
            {w.word}
          </motion.span>
        );
      })}
    </p>
  );
}
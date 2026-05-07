/**
 * src/components/KaraokeText.tsx
 *
 * Word-by-word highlight animation.
 *
 * Performance: pure CSS class toggle — no Framer Motion overhead per word.
 * A 10-word utterance was creating 10 motion.span animation contexts; now 0.
 *
 * Day 5: When WhisperX returns real word timestamps, drive highlight
 *        with a useEffect timer based on word.start_time offsets.
 */

import { useMemo } from "react";
import type { WordToken } from "../store/atoms";

interface KaraokeTextProps {
  words: WordToken[];
  isSpeaking: boolean;
}

export default function KaraokeText({ words, isSpeaking }: KaraokeTextProps) {
  // Highlight the last word while speaking — placeholder until WhisperX timestamps
  const highlightedIndex = useMemo(
    () => (isSpeaking ? words.length - 1 : -1),
    [isSpeaking, words.length]
  );

  return (
    <p className="jp-text karaoke">
      {words.map((w, i) => (
        <span
          key={`${w.word}-${i}`}
          className={`karaoke-word${i === highlightedIndex ? " karaoke-word--active" : ""}`}
        >
          {w.word}
        </span>
      ))}
    </p>
  );
}
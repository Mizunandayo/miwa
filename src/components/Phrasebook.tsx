/**
 * src/components/Phrasebook.tsx
 *
 * Collapsible panel showing saved phrases synced from SQLite.
 * - Ctrl+1–9 triggers botSends for that slot
 * - Each phrase has: I'll Speak | Bot Sends | Delete
 * - Only renders when phrasebook has at least one entry
 */

import { useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { phrasebookAtom, phrasebookOpenAtom, romajiPopupAtom } from "../store/atoms";

interface PhrasebookProps {
  sendCommand: (data: unknown) => void;
}





export default function Phrasebook({ sendCommand }: PhrasebookProps) {
  const [phrases]  = useAtom(phrasebookAtom);
  const [open, setOpen] = useAtom(phrasebookOpenAtom);
  const setRomajiPopup  = useSetAtom(romajiPopupAtom);





  //  ---  Ctrl+1–9 global hotkeys --- 
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const slot = parseInt(e.key, 10);
      if (slot < 1 || slot > 9) return;
      e.preventDefault();
      const phrase = phrases.find((p) => p.slot === slot);
      if (phrase) {
        sendCommand({ action: "botSends", text: phrase.jp });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phrases, sendCommand]);

  if (phrases.length === 0) return null;

  return (
    <div className="phrasebook">
      {/* --- Header --- */}
      <button
        className="phrasebook-header"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse phrasebook" : "Expand phrasebook"}
      >
        <span className="phrasebook-icon">📖</span>
        <span className="phrasebook-title">Phrasebook</span>
        <span className="phrasebook-count">{phrases.length}</span>
        <span className={`phrasebook-chevron${open ? " open" : ""}`}>▸</span>
      </button>

      {/* --- Phrase list --- */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="phrase-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="phrasebook-list">
              {phrases.map((p) => (
                <div key={p.id} className="phrase-row">
                  <span
                    className="phrase-slot"
                    title={p.slot ? `Ctrl+${p.slot}` : "No hotkey"}
                  >
                    {p.slot ?? "·"}
                  </span>
                  <div className="phrase-text">
                    <span className="phrase-jp">{p.jp}</span>
                    <span className="phrase-romaji">{p.romaji}</span>
                  </div>
                  <div className="phrase-actions">
                    <button
                      className="phrase-btn phrase-btn--speak"
                      title="I'll Speak — show romaji"
                      onClick={() =>
                        setRomajiPopup({ jp: p.jp, romaji: p.romaji })
                      }
                    >
                      🗣
                    </button>
                    <button
                      className="phrase-btn phrase-btn--send"
                      title="Bot Sends to text channel"
                      onClick={() =>
                        sendCommand({ action: "botSends", text: p.jp })
                      }
                    >
                      💬
                    </button>
                    <button
                      className="phrase-btn phrase-btn--delete"
                      title="Remove from phrasebook"
                      onClick={() =>
                        sendCommand({ action: "deletePhrase", id: p.id })
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
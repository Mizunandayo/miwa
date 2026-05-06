/**
 * src/components/RomajiPopup.tsx
 *
 * Full-screen romaji overlay for "I'll Speak" delivery.
 * Triggered via romajiPopupAtom — renders at App.tsx root level.
 *
 * Dismiss: click background | press Escape | click ✕ button
 */




import { useEffect } from "react";
import { useAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { romajiPopupAtom } from "../store/atoms";


export default function RomajiPopUp() {
    const [popup, setPopup] = useAtom(romajiPopupAtom);


    // Escape key dismisses popup
    useEffect(() => {
        if (!popup) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPopup(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [popup, setPopup]);


 return (
    <AnimatePresence>
      {popup && (
        <motion.div
          className="romaji-popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={() => setPopup(null)} // click outside to close
        >
          <motion.div
            className="romaji-popup-card"
            initial={{ scale: 0.91, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()} // prevent close when clicking card
          >
            <p className="romaji-popup-label">Read aloud</p>
            <p className="romaji-popup-text">{popup.romaji}</p>
            <p className="romaji-popup-jp">{popup.jp}</p>
            <button
              className="romaji-popup-close"
              onClick={() => setPopup(null)}
            >
              ✕ Close <kbd className="romaji-popup-esc">Esc</kbd>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
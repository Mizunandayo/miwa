/**
 * src/components/QuickReplyBox.tsx
 *
 * Live debounced EN→JP translation as user types.
 * Debounce: 500ms after last keystroke → sends to server → shows JP + romaji.
 * Re-translates automatically when style mode changes (if input has text).
 *
 * NOTE: Input is UNCONTROLLED (no value={} prop) so WebView2 can handle
 * Ctrl+C/X/V natively. React controlled inputs break native clipboard in WebView2.
 */

import { useRef, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import {
  quickReplyResultAtom,
  quickReplyLoadingAtom,
  styleModeAtom,
} from "../store/atoms";

interface QuickReplyBoxProps {
  sendCommand: (data: unknown) => void;
}

const DEBOUNCE_MS = 500;

export default function QuickReplyBox({ sendCommand }: QuickReplyBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleModeRef = useRef<string>("casual");

  const [result, setResult] = useAtom(quickReplyResultAtom);
  const [loading, setLoading] = useAtom(quickReplyLoadingAtom);
  const [styleMode] = useAtom(styleModeAtom);
  const [hasText, setHasText] = useState(false);
  const [open, setOpen] = useState(true);

  // Keep ref in sync so debounce callback always sees latest style
  useEffect(() => { styleModeRef.current = styleMode; }, [styleMode]);

  const triggerTranslate = (text: string, style: string) => {
    if (!text.trim()) { setResult(null); setLoading(false); return; }
    setLoading(true);
    setResult(null);
    sendCommand({ action: "quickReply", text: text.trim(), style });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHasText(val.length > 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResult(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      triggerTranslate(val, styleModeRef.current);
    }, DEBOUNCE_MS);
  };

  // Re-translate when style changes (if there's existing text in the input)
  useEffect(() => {
    const currentVal = inputRef.current?.value ?? "";
    if (!currentVal.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerTranslate(currentVal, styleMode);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleMode]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSend = () => {
    if (!result) return;
    sendCommand({ action: "botSends", text: result.jp });
  };

  const handleBotSpeaks = () => {
    if (!result) return;
    sendCommand({ action: "botSpeaks", text: result.jp });
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setHasText(false);
    setResult(null);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && result) handleSend();
    if (e.key === "Escape") handleClear();
  };

  const styleLabelMap: Record<string, string> = {
    formal: "Formal",
    neutral: "Neutral",
    casual: "Casual",
    gaming: "Gaming",
  };

  return (
    <div className="quick-reply-box">
      {/* ── Collapse header ─────────────────────────────────────────── */}
      <div className="panel-header" onClick={() => setOpen((v) => !v)}>
        <span className="panel-header-label">Quick Reply</span>
        {!open && loading && <span className="quick-reply-spinner" style={{ marginLeft: 4 }}>⟳</span>}
        <button
          className="panel-toggle"
          title={open ? "Collapse" : "Expand"}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="qr-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="quick-reply-inner">
              <div className="quick-reply-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="quick-reply-input"
                  placeholder={`Type English — translates as ${styleLabelMap[styleMode] ?? styleMode}…`}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  maxLength={300}
                />
                {hasText && (
                  <button className="quick-reply-clear" onClick={handleClear} title="Clear">✕</button>
                )}
                {loading && <span className="quick-reply-spinner">⟳</span>}
              </div>

              {result && (
                <div className="quick-reply-preview">
                  <div className="quick-reply-preview-text">
                    <div className="quick-reply-jp">{result.jp}</div>
                    <div className="quick-reply-romaji">{result.romaji}</div>
                  </div>
                  <button className="quick-reply-speaks" onClick={handleBotSpeaks} title="Bot speaks in VC">
                    🔊
                  </button>
                  <button className="quick-reply-send" onClick={handleSend} title="Enter">
                    Send
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * src/components/QuickReplyBox.tsx
 *
 * Live debounced EN→JP translation as user types.
 * Debounce: 500ms after last keystroke → sends to server → shows JP + romaji.
 * Re-translates automatically when style mode changes (if input has text).
 */

import { useRef, useEffect, useState } from "react";
import { useAtom } from "jotai";
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

  const [result, setResult] = useAtom(quickReplyResultAtom);
  const [loading, setLoading] = useAtom(quickReplyLoadingAtom);
  const [styleMode] = useAtom(styleModeAtom);
  const [inputValue, setInputValue] = useState("");

  // Fire translation request
  const triggerTranslate = (text: string, style: string) => {
    if (!text.trim()) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setResult(null);
    sendCommand({ action: "quickReply", text: text.trim(), style });
  };

  // Debounce on input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true); // show spinner immediately while waiting
    debounceRef.current = setTimeout(() => {
      triggerTranslate(val, styleMode);
    }, DEBOUNCE_MS);
  };

  // Re-translate when style changes (if there's existing text)
  useEffect(() => {
    if (!inputValue.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerTranslate(inputValue, styleMode);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
    setResult(null);
    setInputValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && result) handleSend();
    if (e.key === "Escape") handleClear();
  };

  // stopPropagation prevents Tauri's drag region from swallowing clipboard events.
  // Do NOT preventDefault — let the browser/WebView2 handle the actual clipboard read/write natively.
  const handleCut = (e: React.ClipboardEvent<HTMLInputElement>) => { e.stopPropagation(); };
  const handleCopy = (e: React.ClipboardEvent<HTMLInputElement>) => { e.stopPropagation(); };
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => { e.stopPropagation(); };

  const styleLabelMap: Record<string, string> = {
    formal: "Formal",
    neutral: "Neutral",
    casual: "Casual",
    gaming: "Gaming",
  };

  return (
    <div className="quick-reply-box">
      <div className="quick-reply-input-row">
        <input
          ref={inputRef}
          type="text"
          className="quick-reply-input"
          placeholder={`Type English — translates as ${styleLabelMap[styleMode] ?? styleMode}…`}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          maxLength={300}
        />
        {inputValue && (
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
  );
}

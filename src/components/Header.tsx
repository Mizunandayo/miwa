/**
 * src/components/Header.tsx
 *
 * Features:
 * - data-tauri-drag-region for native window dragging (no JS needed)
 * - Style mode buttons (Formal / Neutral / Casual / Gaming)
 * - Opacity slider (40–100%) using Tauri Window API
 * - Mini mode toggle
 * - Click-through toggle using Tauri Window API
 * - Bot status indicator with color coding
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import {
  styleModeAtom,
  opacityAtom,
  isMiniModeAtom,
  isClickThroughAtom,
  botStatusAtom,
  channelNameAtom,
  wsStatusAtom,
  darkCardsAtom,
  type StyleMode,
} from "../store/atoms";

interface HeaderProps {
  sendCommand: (data: unknown) => void;
}

const STYLES: { key: StyleMode; label: string }[] = [
  { key: "formal",  label: "Formal"  },
  { key: "neutral", label: "Neutral" },
  { key: "casual",  label: "Casual"  },
  { key: "gaming",  label: "Gaming"  },
];

const STATUS_COLOR: Record<string, string> = {
  disconnected: "#ef4444",
  connecting:   "#f59e0b",
  connected:    "#22c55e",
  joined:       "#3b9eff",
};

export default function Header({ sendCommand }: HeaderProps) {
  const [styleMode, setStyleMode] = useAtom(styleModeAtom);
  const [opacity, setOpacity]     = useAtom(opacityAtom);
  const [isMiniMode, setIsMiniMode]       = useAtom(isMiniModeAtom);
  const [isClickThrough, setIsClickThrough] = useAtom(isClickThroughAtom);
  const [darkCards, setDarkCards] = useAtom(darkCardsAtom);
  const [botStatus]    = useAtom(botStatusAtom);
  const [channelName]  = useAtom(channelNameAtom);
  const [wsStatus]     = useAtom(wsStatusAtom);
  const [showHelp, setShowHelp] = useState(false);

  const handleStyleChange = (mode: StyleMode) => {
    setStyleMode(mode);
    sendCommand({ action: "setStyle", style: mode });
  };

  const handleOpacity = (value: number) => {
    setOpacity(value);
    const root = document.getElementById("root");
    if (root) root.style.opacity = String(value / 100);
  };

  const handleClickThrough = async () => {
    const next = !isClickThrough;
    setIsClickThrough(next);
    try {
      await getCurrentWindow().setIgnoreCursorEvents(next);
    } catch { /* non-critical */ }
  };

  const handleMinimize = async () => {
    try { await getCurrentWindow().minimize(); } catch {}
  };

  const handleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      if (await win.isMaximized()) await win.unmaximize();
      else await win.maximize();
    } catch {}
  };

  const handleClose = async () => {
    try { await getCurrentWindow().close(); } catch {}
  };






  /**
   * Snap window to the nearest screen corner on header double-click.
   * Uses outerposition (physical px) +  devicepixelratio -> logical px.
   * nearest corner determined by with screen quadrat the window ceenter
   */
  const handleSnapToCorner = async () => {
    try {
      const win = getCurrentWindow();
      const pos  = await win.outerPosition(); // physical pixels
      const size = await win.outerSize();     // physical pixels
      const sf   = window.devicePixelRatio || 1;

      // Convert to logical coordinates
      const logX = pos.x  / sf;
      const logY = pos.y  / sf;
      const logW = size.width  / sf;
      const logH = size.height / sf;

      const sw = window.screen.width;  // logical screen width
      const sh = window.screen.height; // logical screen height
      const MARGIN = 16;

      // Find which quadrant the window center is in → snap to that corner
      const cx = logX + logW / 2;
      const cy = logY + logH / 2;
      const snapX = cx < sw / 2 ? MARGIN : sw - logW - MARGIN;
      const snapY = cy < sh / 2 ? MARGIN : sh - logH - MARGIN;

      await win.setPosition(new LogicalPosition(snapX, snapY));
    } catch {
      // Non-critical — ignore if permission not granted or window hidden
    }
  };



  const displayStatus =
    botStatus === "joined" && channelName ? channelName : botStatus;












  return (
    <div className="header">
      {/* Drag region — Tauri handles drag natively via this attribute */}
            <div
        className="drag-handle"
        data-tauri-drag-region
        onDoubleClick={() => void handleSnapToCorner()}
        title="Double-click to snap to nearest corner"
      >
        <div className="drag-dots" data-tauri-drag-region />
        <span className="app-name" data-tauri-drag-region>Miwa</span>

        {wsStatus === "closed" && (
          <span className="ws-banner" style={{ fontSize: "9px", padding: "1px 4px" }}>
            bot offline
          </span>
        )}

        <div className="status-indicator">
          <span
            className="status-dot"
            style={{ background: STATUS_COLOR[botStatus] ?? "#555" }}
          />
          <span className="status-text">{displayStatus}</span>
        </div>

        <div className="win-controls">
          <button className="win-btn win-btn-minimize" onClick={() => void handleMinimize()} title="Minimize" aria-label="Minimize" />
          <button className="win-btn win-btn-maximize" onClick={() => void handleMaximize()} title="Maximize / Restore" aria-label="Maximize" />
          <button className="win-btn win-btn-close"    onClick={() => void handleClose()}    title="Close" aria-label="Close" />
        </div>
      </div>

      {/* Style mode buttons — hidden in mini mode */}
      {!isMiniMode && (
        <div className="style-buttons">
          {STYLES.map(({ key, label }) => (
            <button
              key={key}
              className={`style-btn${styleMode === key ? " active" : ""}`}
              onClick={() => handleStyleChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Controls: opacity slider + icon buttons */}
      <div className="controls-row">
        {!isMiniMode && (
          <div className="opacity-control">
            <span className="control-label">Opacity</span>
            <input
              type="range"
              min={40}
              max={100}
              value={opacity}
              className="opacity-slider"
              onChange={(e) => void handleOpacity(Number(e.target.value))}
            />
            <span className="opacity-value">{opacity}%</span>
          </div>
        )}

        <div className="header-actions">
          <button
            className={`icon-btn${darkCards ? " active" : ""}`}
            title="Dark cards (solid black background)"
            onClick={() => setDarkCards(!darkCards)}
          >
            ◐
          </button>
          <button
            className={`icon-btn${isMiniMode ? " active" : ""}`}
            title="Mini mode"
            onClick={() => setIsMiniMode(!isMiniMode)}
          >
            ▪
          </button>
          <button
            className={`icon-btn${isClickThrough ? " active" : ""}`}
            title="Click-through (keyboard only)"
            onClick={() => void handleClickThrough()}
          >
            ⊙
          </button>
          <button
            className={`icon-btn${showHelp ? " active" : ""}`}
            title="Keyboard shortcuts"
            onClick={() => setShowHelp(!showHelp)}
          >
            ?
          </button>
        </div>
      </div>

      {/* ── Shortcuts modal ─────────────────────────────────────────── */}
      {showHelp && (
        <div className="help-modal" onClick={() => setShowHelp(false)}>
          <div className="help-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal__header">
              <span className="help-modal__title">Keyboard Shortcuts</span>
              <button className="help-modal__close" onClick={() => setShowHelp(false)}>✕</button>
            </div>

            <div className="help-modal__section-label">Suggestions</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>1</kbd><span>Send suggestion #1 to Discord chat</span></div>
              <div className="help-modal__row"><kbd>2</kbd><span>Send suggestion #2 to Discord chat</span></div>
              <div className="help-modal__row"><kbd>3</kbd><span>Send suggestion #3 to Discord chat</span></div>
            </div>

            <div className="help-modal__section-label">Phrasebook</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>Ctrl</kbd><span>+</span><kbd>1</kbd><span>Send saved phrase slot 1</span></div>
              <div className="help-modal__row"><kbd>Ctrl</kbd><span>+</span><kbd>2–9</kbd><span>Send saved phrase slots 2–9</span></div>
            </div>

            <div className="help-modal__section-label">Romaji Popup</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>Esc</kbd><span>Close fullscreen romaji overlay</span></div>
            </div>

            <div className="help-modal__section-label">Window</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>Dbl-click</kbd><span>header — snap to nearest corner</span></div>
            </div>

            <div className="help-modal__section-label">Quick Reactions</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>💬</kbd><span>Send JP text to Discord chat</span></div>
              <div className="help-modal__row"><kbd>🔊</kbd><span>Bot speaks JP text aloud in VC</span></div>
              <div className="help-modal__row"><span className="help-modal__note">Mouse-wheel over cards scrolls horizontally</span></div>
            </div>

            <div className="help-modal__section-label">Suggestions (on card)</div>
            <div className="help-modal__rows">
              <div className="help-modal__row"><kbd>Bot Speaks</kbd><span>TTS reads reply in voice channel</span></div>
              <div className="help-modal__row"><kbd>Bot Sends</kbd><span>Posts reply to channel text chat</span></div>
              <div className="help-modal__row"><kbd>I'll Speak</kbd><span>Opens fullscreen romaji to read aloud yourself</span></div>
              <div className="help-modal__row"><kbd>📌</kbd><span>Save phrase to phrasebook</span></div>
            </div>

            <p className="help-modal__footer">Click anywhere outside to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
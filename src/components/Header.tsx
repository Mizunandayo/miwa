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

import { useAtom, useSetAtom } from "jotai";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  styleModeAtom,
  opacityAtom,
  isMiniModeAtom,
  isClickThroughAtom,
  botStatusAtom,
  channelNameAtom,
  wsStatusAtom,
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
  const [botStatus]    = useAtom(botStatusAtom);
  const [channelName]  = useAtom(channelNameAtom);
  const [wsStatus]     = useAtom(wsStatusAtom);

  const handleStyleChange = (mode: StyleMode) => {
    setStyleMode(mode);
    sendCommand({ action: "setStyle", style: mode });
  };

  const handleOpacity = (value: number) => {
    setOpacity(value);
  };

  const handleClickThrough = async () => {
    const next = !isClickThrough;
    setIsClickThrough(next);
    try {
      await getCurrentWindow().setIgnoreCursorEvents(next);
    } catch { /* non-critical */ }
  };

  const displayStatus =
    botStatus === "joined" && channelName ? channelName : botStatus;

  return (
    <div className="header">
      {/* Drag region — Tauri handles drag natively via this attribute */}
      <div className="drag-handle" data-tauri-drag-region>
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
        </div>
      </div>
    </div>
  );
}
/**
 * src/App.tsx — Miwa overlay root
 *
 * Responsibilities:
 * 1. Connect to bot's UI WebSocket (ws://127.0.0.1:8766)
 * 2. Parse incoming fast/refined/status packets
 * 3. Update Jotai atoms
 * 4. Schedule speaker card auto-removal after 8s of inactivity
 * 5. Render Header + AnimatePresence speaker card list
 */

import { useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useAtom, useSetAtom } from "jotai";
import { AnimatePresence } from "framer-motion";
import {
  speakersAtom,
  speakerOrderAtom,
  orderedSpeakersAtom,
  botStatusAtom,
  channelNameAtom,
  callInfoAtom,
  statsAtom,
  wsStatusAtom,
  quickReplyResultAtom,
  quickReplyLoadingAtom,
  romajiPopupAtom,
  phrasebookAtom,
  darkCardsAtom,
  type PhrasebookEntry,
  type SpeakerState,
  type CallInfo,
} from "./store/atoms";
import Header from "./components/Header";
import SpeakerCard from "./components/SpeakerCard";
import QuickReplyBox from "./components/QuickReplyBox";
import CallInfoStrip from "./components/CallInfoStrip";
import RomajiPopup from "./components/RomajiPopup";
import QuickReactions from "./components/QuickReactions";
import Phrasebook     from "./components/Phrasebook";
import StatsPanel     from "./components/StatsPanel";








const UI_WS_URL = "ws://127.0.0.1:8766";
const SPEAKER_TIMEOUT_MS = 8_000; // Remove card after 8s of inactivity

export default function App() {
  const setSpeakers = useSetAtom(speakersAtom);
  const setSpeakerOrder = useSetAtom(speakerOrderAtom);
  const [orderedSpeakers] = useAtom(orderedSpeakersAtom);
  const setBotStatus = useSetAtom(botStatusAtom);
  const setChannelName = useSetAtom(channelNameAtom);
  const setCallInfo = useSetAtom(callInfoAtom);
  const setStats = useSetAtom(statsAtom);
  const setWsStatus = useSetAtom(wsStatusAtom);
  const setQuickReplyResult = useSetAtom(quickReplyResultAtom);
  const setQuickReplyLoading = useSetAtom(quickReplyLoadingAtom);
  const setPhrasebook = useSetAtom(phrasebookAtom);
  const [darkCards] = useAtom(darkCardsAtom);

  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // ── Schedule speaker card removal after inactivity ─────────────────────
  const scheduleSpeakerRemoval = useCallback(
    (userId: string) => {
      const existing = timeoutRefs.current.get(userId);
      if (existing) clearTimeout(existing);

      const t = setTimeout(() => {
        setSpeakers((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
        setSpeakerOrder((prev) => prev.filter((id) => id !== userId));
        timeoutRefs.current.delete(userId);
      }, SPEAKER_TIMEOUT_MS);

      timeoutRefs.current.set(userId, t);
    },
    [setSpeakers, setSpeakerOrder]
  );

  // ── Handle incoming WebSocket packet ───────────────────────────────────
  const handlePacket = useCallback(
    (raw: string) => {
      let packet: Record<string, unknown>;
      try {
        packet = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return; // Discard malformed JSON
      }

      const type = packet.type as string;

      // Status events from bot
      if (type === "status") {
        const event = packet.event as string;
        if (event === "joined") {
          setBotStatus("joined");
          setChannelName((packet.channelName as string) ?? "");
        } else if (event === "left") {
          setBotStatus("connected");
          setChannelName("");
        } else if (event === "ready") {
          setBotStatus("connected");
        }
        return;
      }

      // Call info from bot (guild, channel, members)
      if (type === "call_info") {
        const guildName = (packet.guildName as string) ?? "";
        const channelName = (packet.channelName as string) ?? "";
        const members = (packet.members as CallInfo["members"]) ?? [];
        if (guildName) {
          const guildIconB64 = (packet.guildIconB64 as string | null) ?? null;
          setCallInfo({ guildName, guildIconB64, channelName, members });
        } else {
          setCallInfo(null);
        }
        return;
      }

      // Phrasebook sync from bot (on save / delete / connect)
      if (type === "phrasebook") {
        setPhrasebook((packet.phrases as PhrasebookEntry[]) ?? []);
        return;
      }

      // Quick reply EN→JP result from server
      if (type === "quick_reply_result") {
        setQuickReplyLoading(false);
        setQuickReplyResult({
          jp: (packet.jp as string) ?? "",
          romaji: (packet.romaji as string) ?? "",
          en: (packet.en as string) ?? "",
        });
        return;
      }

      // Translation packets
      if (type === "fast" || type === "refined") {
        const userId = packet.userId as string;
        if (!userId) return;

        const suggestionsOnly = packet.suggestionsOnly === true;

        setSpeakers((prev) => {
          const next = new Map(prev);
          const existing = next.get(userId);

          // suggestionsOnly: only patch suggestions, leave everything else
          if (suggestionsOnly && existing) {
            next.set(userId, {
              ...existing,
              suggestions:
                (packet.suggestions as SpeakerState["suggestions"]) ??
                existing.suggestions,
            });
            return next;
          }

          const updated: SpeakerState = {
            userId,
            username:
              (packet.username as string) ?? existing?.username ?? userId,
            avatarB64:
              (packet.avatarB64 as string | null) ??
              existing?.avatarB64 ??
              null,
            jp: (packet.jp as string) ?? existing?.jp ?? "",
            en: (packet.en as string) ?? existing?.en ?? "",
            romaji: (packet.romaji as string) ?? existing?.romaji ?? "",
            words:
              (packet.words as SpeakerState["words"]) ??
              existing?.words ??
              [],
            // Only update suggestions on refined packet
            suggestions:
              type === "refined"
                ? ((packet.suggestions as SpeakerState["suggestions"]) ??
                  existing?.suggestions ??
                  [])
                : (existing?.suggestions ?? []),
            translationSource:
              (packet.translationSource as SpeakerState["translationSource"]) ??
              "google",
            source:
              (packet.source as SpeakerState["source"]) ?? "voice",
            isSpeaking: type === "fast",
            lastUpdated: Date.now(),
          };

          next.set(userId, updated);
          return next;
        });

        // Add to order only if first appearance
        setSpeakerOrder((prev) =>
          prev.includes(userId) ? prev : [...prev, userId]
        );

        // Update latency stats
        if (typeof packet.latencyMs === "number") {
          setStats({ latencyMs: packet.latencyMs, lastUpdated: Date.now() });
        }

        scheduleSpeakerRemoval(userId);
      }
    },
    [
      setSpeakers,
      setSpeakerOrder,
      setBotStatus,
      setChannelName,
      setCallInfo,
      setStats,
      scheduleSpeakerRemoval,
      setQuickReplyResult,
      setQuickReplyLoading,
      setPhrasebook,
    ]
  );

  // ── WebSocket connection with auto-reconnect ───────────────────────────
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setWsStatus("connecting");

      const ws = new WebSocket(UI_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("open");
        setBotStatus("connected");
      };

      ws.onmessage = (e) => handlePacket(e.data as string);

      ws.onclose = () => {
        setWsStatus("closed");
        setBotStatus("disconnected");
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2_000);
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror — reconnect handled there
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      for (const t of timeoutRefs.current.values()) clearTimeout(t);
      timeoutRefs.current.clear();
    };
  }, [handlePacket, setBotStatus, setWsStatus]);

  // ── Send command to bot via WS ─────────────────────────────────────────
  const sendCommand = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);




  // --- 1/2/3 key shortcuts → botSends for most recently active speaker ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const idx = parseInt(e.key, 10) - 1;
      if (idx < 0 || idx > 2) return;

      const candidates = orderedSpeakers.filter((s) => s.suggestions.length > idx);
      if (!candidates.length) return;

      const active = candidates.reduce((a, b) =>
        a.lastUpdated > b.lastUpdated ? a : b
      );

      e.preventDefault();
      sendCommand({ action: "botSends", text: active.suggestions[idx].jp });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderedSpeakers, sendCommand]);




  // ── Bottom resize handle ────────────────────────────────────────────────
  const resizeDragRef = useRef<{ startY: number; startH: number } | null>(null);




  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startY: e.clientY, startH: window.innerHeight };

    const onMouseMove = async (ev: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const delta = ev.clientY - resizeDragRef.current.startY;
      const newH = Math.max(260, resizeDragRef.current.startH + delta);
      try {
        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(window.innerWidth, newH));
      } catch { /* ignore */ }
    };

    const onMouseUp = () => {
      resizeDragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div className="overlay-root">
      <Header sendCommand={sendCommand} />
      <QuickReplyBox sendCommand={sendCommand} />
      <CallInfoStrip />
      <QuickReactions sendCommand={sendCommand} />
      <div className={`speaker-list${darkCards ? " dark-cards" : ""}`}>
        <AnimatePresence mode="popLayout">
          {orderedSpeakers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🎙️</span>
              <span className="empty-state-text">
                type !join in Discord to start
              </span>
            </div>
          ) : (
            orderedSpeakers.map((speaker) => (
              <SpeakerCard key={speaker.userId} speaker={speaker} sendCommand={sendCommand} />
            ))
          )}
        </AnimatePresence>
      </div>
      <Phrasebook sendCommand={sendCommand} />
      <StatsPanel />
      {/* Bottom resize grip */}
      <div className="resize-handle" onMouseDown={onResizeMouseDown} />
      {/* Full-screen overlay — must render last for correct z-index */}
      <RomajiPopup />
    </div>
  );
}
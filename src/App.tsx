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
import { useAtom, useSetAtom } from "jotai";
import { AnimatePresence } from "framer-motion";
import {
  speakersAtom,
  speakerOrderAtom,
  orderedSpeakersAtom,
  botStatusAtom,
  channelNameAtom,
  statsAtom,
  wsStatusAtom,
  type SpeakerState,
} from "./store/atoms";
import Header from "./components/Header";
import SpeakerCard from "./components/SpeakerCard";

const UI_WS_URL = "ws://127.0.0.1:8766";
const SPEAKER_TIMEOUT_MS = 8_000; // Remove card after 8s of inactivity

export default function App() {
  const setSpeakers = useSetAtom(speakersAtom);
  const setSpeakerOrder = useSetAtom(speakerOrderAtom);
  const [orderedSpeakers] = useAtom(orderedSpeakersAtom);
  const setBotStatus = useSetAtom(botStatusAtom);
  const setChannelName = useSetAtom(channelNameAtom);
  const setStats = useSetAtom(statsAtom);
  const setWsStatus = useSetAtom(wsStatusAtom);

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

      // Translation packets
      if (type === "fast" || type === "refined") {
        const userId = packet.userId as string;
        if (!userId) return;

        setSpeakers((prev) => {
          const next = new Map(prev);
          const existing = next.get(userId);

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
      setStats,
      scheduleSpeakerRemoval,
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

  return (
    <div className="overlay-root">
      <Header sendCommand={sendCommand} />
      <div className="speaker-list">
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
              <SpeakerCard key={speaker.userId} speaker={speaker} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
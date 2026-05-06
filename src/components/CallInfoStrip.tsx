/**
 * src/components/CallInfoStrip.tsx
 *
 * Compact collapsible strip showing:
 * - Collapsed: ⚡ Server · #channel · N in call
 * - Expanded:  member list with avatar initials / images
 *
 * Hidden entirely when not in a call.
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { callInfoAtom } from "../store/atoms";
import { motion, AnimatePresence } from "framer-motion";

export default function CallInfoStrip() {
  const [callInfo] = useAtom(callInfoAtom);
  const [open, setOpen] = useState(false);

  if (!callInfo || !callInfo.guildName) return null;

  const { guildName, channelName, members } = callInfo;
  const count = members.length;

  return (
    <div className="call-info-strip">
      {/* ── Collapsed bar ──────────────────────────────────────────── */}
      <button
        className="call-info-bar"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse call info" : "Expand call info"}
      >
        {callInfo.guildIconB64 ? (
          <img
            src={callInfo.guildIconB64}
            alt=""
            className="call-info-guild-icon"
            draggable={false}
          />
        ) : (
          <span className="call-info-guild-icon-fallback">⚡</span>
        )}
        <span className="call-info-server">{guildName}</span>
        <span className="call-info-sep">·</span>
        <span className="call-info-channel">#{channelName}</span>
        <span className="call-info-sep">·</span>
        <span className="call-info-count">{count} in call</span>
        <span className={`call-info-chevron${open ? " open" : ""}`}>▸</span>
      </button>

      {/* ── Expanded member list ────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="members"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="call-info-members">
              {members.map((m) => (
                <div key={m.userId} className="call-info-member">
                  {m.avatarB64 ? (
                    <img
                      src={m.avatarB64}
                      alt={m.username}
                      className="call-info-avatar"
                      draggable={false}
                    />
                  ) : (
                    <div className="call-info-avatar call-info-avatar-placeholder">
                      {m.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="call-info-username">{m.username}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

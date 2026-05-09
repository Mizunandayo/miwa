/**
 * src/components/CallInfoStrip.tsx
 *
 * Compact collapsible strip showing:
 * - Collapsed: ⚡ Server · #channel · N in call
 * - Expanded:  member list with per-member enable/disable toggle
 *
 * Disabled members are completely skipped by the bot's translation pipeline.
 * Useful when non-Japanese speakers are in the same call.
 *
 * Real-time updates:
 * - Members are added/removed instantly via voiceStateUpdate events from bot
 * - Toggle state is cleared automatically when a user leaves the VC
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { callInfoAtom, disabledUsersAtom } from "../store/atoms";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  sendCommand: (data: unknown) => void;
}

export default function CallInfoStrip({ sendCommand }: Props) {
  const [callInfo] = useAtom(callInfoAtom);
  const [disabledUsers, setDisabledUsers] = useAtom(disabledUsersAtom);
  const [open, setOpen] = useState(false);

  if (!callInfo || !callInfo.guildName) return null;

  const { guildName, channelName, members } = callInfo;
  const count = members.length;

  const toggleUser = (userId: string) => {
    const willDisable = !disabledUsers.has(userId);
    // Optimistic UI update
    setDisabledUsers((prev) => {
      const next = new Set(prev);
      if (willDisable) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
    // Sync to bot so the pipeline filter is updated
    sendCommand({ action: "toggleUser", userId, disabled: willDisable });
  };

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
        {disabledUsers.size > 0 && (
          <span className="call-info-muted-badge" title={`${disabledUsers.size} muted`}>
            {disabledUsers.size} muted
          </span>
        )}
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
              <div className="call-info-members-hint">
                Click to mute from pipeline
              </div>
              {members.map((m) => {
                const isDisabled = disabledUsers.has(m.userId);
                return (
                  <div
                    key={m.userId}
                    className={`call-info-member${isDisabled ? " is-disabled" : ""}`}
                  >
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
                    <button
                      className={`call-info-member-toggle${isDisabled ? " is-muted" : " is-active"}`}
                      onClick={() => toggleUser(m.userId)}
                      title={isDisabled ? "Click to enable — user is muted from pipeline" : "Click to mute from pipeline"}
                    >
                      {isDisabled ? "✕" : "✓"}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

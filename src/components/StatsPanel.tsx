/**
 * src/components/StatsPanel.tsx
 *
 * Minimal bottom strip showing:
 * - Round-trip latency (color-coded: green < 400ms, amber < 800ms, red ≥ 800ms)
 * - WS connection status
 *
 * Hidden until first packet arrives (lastUpdated === 0 check).
 */




import { useAtom } from "jotai";
import { statsAtom, wsStatusAtom } from "../store/atoms";

export default function StatsPanel() {
    const [stats] = useAtom(statsAtom);
    const [wsStatus] = useAtom(wsStatusAtom);


    // Don't render before first translation packet
    if (stats.lastUpdated === 0) return null;

    const latencyColor =
        stats.latencyMs < 400 ? "var(--green)"  :
        stats.latencyMs < 800 ? "var(--amber)"  :
        "var(--red)";



    
     return (
    <div className="stats-panel">
      <span className="stats-item">
        <span className="stats-label">⚡</span>
        <span className="stats-value" style={{ color: latencyColor }}>
          {stats.latencyMs}ms
        </span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">WS</span>
        <span className={`stats-value stats-ws-${wsStatus}`}>{wsStatus}</span>
      </span>
    </div>
     )   
}
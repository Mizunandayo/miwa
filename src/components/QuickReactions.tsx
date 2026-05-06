/**
 * src/components/QuickReactions.tsx
 *
 * One-click reaction phrases sent directly to Discord text chat.
 * No translation step — pre-written natural Japanese.
 * Each button sends via botSends action.
 */





interface QuickReactionsProps {
  sendCommand: (data: unknown) => void;
}




const REACTIONS: { label: string; jp: string; title: string }[] = [
  { label: "草",     jp: "草ｗ",           title: "lol" },
  { label: "えー",   jp: "えー！",          title: "Ehh?!" },
  { label: "マジ?",  jp: "マジで？",        title: "Seriously?" },
  { label: "gg",     jp: "gg",             title: "Good game" },
  { label: "もう一回", jp: "もう一回言って", title: "Say that again" },
  { label: "待って",  jp: "ちょっと待って",  title: "Wait a sec" },
];



export default function QuickReactions({ sendCommand }: QuickReactionsProps) {
  return (
    <div className="quick-reactions">
      {REACTIONS.map((r) => (
        <button
          key={r.label}
          className="reaction-btn"
          title={`${r.title} → ${r.jp}`}
          onClick={() => sendCommand({ action: "botSends", text: r.jp })}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
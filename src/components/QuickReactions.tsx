/**
 * src/components/QuickReactions.tsx
 *
 * Pre-written Japanese reaction cards with instant search filter.
 * Cards auto-switch based on the active style mode (Formal/Neutral/Casual/Gaming).
 * Each card shows JP text, romaji, and English meaning.
 * "💬 Send"  → botSends  (Discord text chat)
 * "🔊 Speak" → botSpeaks (bot reads it aloud in VC via TTS)
 *
 * Search filters across jp + romaji + en — no debounce needed (client-side).
 * Mouse-wheel over the card strip scrolls horizontally.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { styleModeAtom, type StyleMode } from "../store/atoms";

interface QuickReactionsProps {
  sendCommand: (data: unknown) => void;
}

interface Reaction {
  jp: string;
  romaji: string;
  en: string;
}

const REACTIONS: Record<StyleMode, Reaction[]> = {
  // ── Formal (keigo / business-style) ─────────────────────────────────────
  formal: [
    { jp: "お疲れ様です",          romaji: "otsukaresama desu",               en: "Good work" },
    { jp: "ありがとうございます",    romaji: "arigatou gozaimasu",              en: "Thank you" },
    { jp: "お願いします",          romaji: "onegai shimasu",                  en: "Please" },
    { jp: "了解しました",          romaji: "ryoukai shimashita",              en: "Understood" },
    { jp: "申し訳ございません",      romaji: "moushiwake gozaimasen",           en: "My apologies" },
    { jp: "失礼します",            romaji: "shitsurei shimasu",               en: "Excuse me" },
    { jp: "少々お待ちください",      romaji: "shoushou omachi kudasai",         en: "Please wait" },
    { jp: "よろしくお願いします",    romaji: "yoroshiku onegai shimasu",        en: "Best regards" },
    { jp: "なるほどですね",         romaji: "naruhodo desu ne",                en: "I see" },
    { jp: "そのとおりです",         romaji: "sono toori desu",                 en: "That's correct" },
    { jp: "ご確認ありがとうございます", romaji: "gokakunin arigatou gozaimasu",  en: "Thanks for confirming" },
    { jp: "お手数をおかけします",    romaji: "otesuu wo okake shimasu",         en: "Sorry to trouble you" },
    { jp: "おはようございます",      romaji: "ohayou gozaimasu",               en: "Good morning" },
    { jp: "こんにちは",            romaji: "konnichiwa",                      en: "Hello" },
    { jp: "こんばんは",            romaji: "konbanwa",                        en: "Good evening" },
    { jp: "お疲れ様でした",         romaji: "otsukaresama deshita",            en: "Good work (done)" },
    { jp: "ご説明ありがとうございます", romaji: "gosetsumei arigatou gozaimasu", en: "Thanks for explaining" },
    { jp: "引き続きよろしくお願いします", romaji: "hikitsuzuki yoroshiku onegai shimasu", en: "Please continue" },
    { jp: "おかげさまで",           romaji: "okagesama de",                   en: "Thanks to you" },
    { jp: "ご連絡ありがとうございます", romaji: "gorenraku arigatou gozaimasu", en: "Thanks for reaching out" },
  ],

  // ── Neutral (everyday natural Japanese) ──────────────────────────────────
  neutral: [
    { jp: "なるほど",     romaji: "naruhodo",         en: "I see" },
    { jp: "わかった",     romaji: "wakatta",          en: "Got it" },
    { jp: "ありがとう",   romaji: "arigatou",         en: "Thank you" },
    { jp: "ごめん",       romaji: "gomen",            en: "Sorry" },
    { jp: "ちょっと待って", romaji: "chotto matte",    en: "Just a moment" },
    { jp: "大丈夫？",     romaji: "daijoubu?",        en: "Are you OK?" },
    { jp: "大丈夫だよ",   romaji: "daijoubu da yo",   en: "I'm fine" },
    { jp: "なんとかなる",  romaji: "nantoka naru",     en: "It'll work out" },
    { jp: "やってみる",   romaji: "yatte miru",       en: "I'll try" },
    { jp: "問題ない",     romaji: "mondai nai",       en: "No problem" },
    { jp: "お疲れ",       romaji: "otsukare",         en: "Good work" },
    { jp: "がんばれ！",   romaji: "ganbare!",         en: "You got this!" },
    { jp: "そうだね",     romaji: "sou da ne",        en: "Yeah, right" },
    { jp: "本当に？",     romaji: "hontou ni?",       en: "Really?" },
    { jp: "どうしよう",   romaji: "dou shiyou",       en: "What should we do?" },
    { jp: "まあまあ",     romaji: "maa maa",          en: "So-so" },
    { jp: "また今度",     romaji: "mata kondo",       en: "Next time" },
    { jp: "楽しかった",   romaji: "tanoshikatta",     en: "That was fun" },
    { jp: "頑張って",     romaji: "ganbatte",         en: "Good luck" },
    { jp: "それはいいね",  romaji: "sore wa ii ne",   en: "That sounds good" },
  ],

  // ── Casual (JP internet / Discord slang) ─────────────────────────────────
  casual: [
    { jp: "草ｗ",         romaji: "kusa",             en: "lol" },
    { jp: "えー！",       romaji: "ee~",              en: "Ehh?!" },
    { jp: "マジで？",     romaji: "maji de?",         en: "Seriously?" },
    { jp: "やばい！",     romaji: "yabai!",           en: "Insane!" },
    { jp: "いいね！",     romaji: "ii ne!",           en: "Nice one!" },
    { jp: "行くぞ！",     romaji: "iku zo!",          en: "Let's go!" },
    { jp: "ドンマイ",     romaji: "don mai",          en: "Don't mind" },
    { jp: "うける",       romaji: "ukeru",            en: "That's funny" },
    { jp: "え、マジ？",   romaji: "e, maji?",         en: "Wait, really?" },
    { jp: "なるね〜",     romaji: "naru ne~",         en: "Makes sense" },
    { jp: "おはよう",     romaji: "ohayou",           en: "Morning" },
    { jp: "もう一回！",   romaji: "mou ikkai!",       en: "One more time!" },
    { jp: "それな",       romaji: "sore na",          en: "Same / Exactly" },
    { jp: "わかる〜",     romaji: "wakaru~",          en: "I feel you" },
    { jp: "ワロタ",       romaji: "warota",           en: "lol (Kansai)" },
    { jp: "きつい",       romaji: "kitsui",           en: "That's rough" },
    { jp: "エモい",       romaji: "emoi",             en: "So emotional" },
    { jp: "ぴえん",       romaji: "pien",             en: "Oof / sad" },
    { jp: "草生えた",     romaji: "kusa haeta",       en: "Dead 💀 (lol)" },
    { jp: "神ゲー",       romaji: "kamige",           en: "God-tier" },
  ],

  // ── Gaming (JP gaming community callouts + net culture) ──────────────────
  gaming: [
    { jp: "gg",           romaji: "gg",               en: "Good game" },
    { jp: "行くぞ！",     romaji: "iku zo!",          en: "Let's go!" },
    { jp: "了解！",       romaji: "ryoukai!",         en: "Roger!" },
    { jp: "ナイス！",     romaji: "naisu!",           en: "Nice!" },
    { jp: "草ｗ",         romaji: "kusa",             en: "lol" },
    { jp: "やばい！",     romaji: "yabai!",           en: "Insane!" },
    { jp: "待って！",     romaji: "matte!",           en: "Wait!" },
    { jp: "ドンマイ",     romaji: "don mai",          en: "Don't mind" },
    { jp: "過ぎんじゃ！",  romaji: "sugiru n ja!",    en: "Too OP!" },
    { jp: "マジで？",     romaji: "maji de?",         en: "Seriously?" },
    { jp: "リスポしろ",   romaji: "respo shiro",      en: "Respawn fast" },
    { jp: "もう一戰！",   romaji: "mou issen!",       en: "One more round!" },
    { jp: "お先に！",     romaji: "osaki ni!",        en: "Going in first!" },
    { jp: "復活！",       romaji: "fukkatsu!",        en: "I'm back!" },
    { jp: "やらかした",   romaji: "yarakashita",      en: "I messed up" },
    { jp: "勝ったー！",   romaji: "kattaa!",          en: "We won!" },
    { jp: "集合！",       romaji: "shuugou!",         en: "Regroup!" },
    { jp: "キャリーして",  romaji: "carry shite",     en: "Please carry me" },
    { jp: "チート？",     romaji: "cheeto?",          en: "Is that a hack?" },
    { jp: "もう少し！",   romaji: "mou sukoshi!",     en: "Almost there!" },
  ],
};

type FlashKey = string;

export default function QuickReactions({ sendCommand }: QuickReactionsProps) {
  const [styleMode] = useAtom(styleModeAtom);
  const [flashing, setFlashing] = useState<FlashKey | null>(null);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  // Reset search + scroll to start when style changes
  useEffect(() => {
    setQuery("");
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [styleMode]);

  // Horizontal scroll via mouse wheel
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY + e.deltaX;
  }, []);

  // Click + drag to scroll horizontally (desktop mouse-friendly)
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current || e.button !== 0) return;
    dragStartXRef.current = e.clientX;
    dragStartScrollRef.current = scrollRef.current.scrollLeft;
    setDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current || !dragging) return;
    const dx = e.clientX - dragStartXRef.current;
    scrollRef.current.scrollLeft = dragStartScrollRef.current - dx;
  }, [dragging]);

  const onMouseUpOrLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const baseReactions = REACTIONS[styleMode];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseReactions;
    return baseReactions.filter(
      (r) =>
        r.jp.includes(q) ||
        r.romaji.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q)
    );
  }, [query, baseReactions]);

  const fire = useCallback(
    (
      e: React.MouseEvent,
      key: FlashKey,
      action: "botSends" | "botSpeaks",
      text: string
    ) => {
      e.stopPropagation();
      sendCommand({ action, text });
      setFlashing(key);
      setTimeout(() => setFlashing(null), 500);
    },
    [sendCommand]
  );

  return (
    <div className="quick-reactions" onWheel={onWheel}>
      {/* Search + style label row */}
      <div className="reaction-search-wrap">
        <input
          ref={inputRef}
          className="reaction-search"
          placeholder={`Search ${styleMode}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        {query && (
          <button
            className="reaction-search__clear"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {/* Cards — horizontal scroll, also scrollable by mouse wheel */}
      <div
        className={`reaction-cards${dragging ? " dragging" : ""}`}
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
      >
        {filtered.length === 0 ? (
          <span className="reaction-no-results">No matches</span>
        ) : (
          filtered.map((r, i) => (
            <div key={`${styleMode}-${r.jp}`} className="reaction-card">
              <div className="reaction-card__text">
                <span className="reaction-card__en">{r.en}</span>
                <span className="reaction-card__romaji">{r.romaji}</span>
                <span className="reaction-card__jp">{r.jp}</span>
              </div>
              <div className="reaction-card__actions">
                <button
                  className={`reaction-card__btn reaction-card__btn--send${
                    flashing === `${i}-send` ? " flash-send" : ""
                  }`}
                  title="Send to chat"
                  onClick={(e) => fire(e, `${i}-send`, "botSends", r.jp)}
                >
                  💬
                </button>
                <button
                  className={`reaction-card__btn reaction-card__btn--speak${
                    flashing === `${i}-speak` ? " flash-speak" : ""
                  }`}
                  title="Bot speaks in VC"
                  onClick={(e) => fire(e, `${i}-speak`, "botSpeaks", r.jp)}
                >
                  🔊
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


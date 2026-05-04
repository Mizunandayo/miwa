/**
 * src/components/RomajiLine.tsx
 * Displays romanized pronunciation in Geist Mono.
 * Returns null if romaji is empty — no wasted space.
 */

interface RomajiLineProps {
  romaji: string;
}

export default function RomajiLine({ romaji }: RomajiLineProps) {
  if (!romaji.trim()) return null;

  return <p className="romaji-line">{romaji}</p>;
}
export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTimeMinutes: number;
  speakingTimeMinutes: number;
  topWords: { word: string; count: number }[];
}

const STOP_WORDS = new Set(
  "a an and are as at be but by for from has have he her his i in is it its of on or she that the their they this to was we were will with you your".split(" "),
);

const READING_WPM = 238;
const SPEAKING_WPM = 150;

/** Counts characters by Unicode code point, so emoji and astral characters count once. */
export function countText(input: string, topN = 5): TextStats {
  const text = input.replace(/\r\n?/g, "\n");
  const characters = [...text].length;
  const charactersNoSpaces = [...text.replace(/\s/g, "")].length;

  const tokens = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  const words = tokens.length;

  const sentences = (text.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const lines = text === "" ? 0 : text.split("\n").length;

  const freq = new Map<string, number>();
  for (const t of tokens) {
    const w = t.toLowerCase();
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    readingTimeMinutes: round1(words / READING_WPM),
    speakingTimeMinutes: round1(words / SPEAKING_WPM),
    topWords,
  };
}

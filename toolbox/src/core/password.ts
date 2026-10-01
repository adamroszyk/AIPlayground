export interface PasswordOptions {
  length?: number;
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  excludeAmbiguous?: boolean;
}

export interface PasswordResult {
  password: string;
  length: number;
  entropyBits: number;
  strength: "weak" | "fair" | "strong" | "very strong";
}

const SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};
const AMBIGUOUS = /[O0oIl1|]/g;

/** Uniform integer in [0, max) using rejection sampling, to avoid modulo bias. */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0]! >= limit);
  return buf[0]! % max;
}

export function generatePassword(opts: PasswordOptions = {}): PasswordResult {
  const { length = 16, lowercase = true, uppercase = true, digits = true, symbols = true, excludeAmbiguous = false } = opts;
  if (!Number.isInteger(length) || length < 4 || length > 128) throw new RangeError("length must be an integer between 4 and 128");

  const pools = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => ({ lowercase, uppercase, digits, symbols })[k])
    .map((k) => (excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, "") : SETS[k]));
  if (pools.length === 0) throw new RangeError("enable at least one character set");
  if (length < pools.length) throw new RangeError("length is too short to include every enabled character set");

  const all = pools.join("");
  // Guarantee one character from each enabled set, fill the rest from the union, then shuffle (Fisher–Yates).
  const chars = pools.map((p) => p[randomInt(p.length)]!);
  while (chars.length < length) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  const entropyBits = Math.round(length * Math.log2(all.length) * 10) / 10;
  const strength = entropyBits < 50 ? "weak" : entropyBits < 70 ? "fair" : entropyBits < 100 ? "strong" : "very strong";
  return { password: chars.join(""), length, entropyBits, strength };
}

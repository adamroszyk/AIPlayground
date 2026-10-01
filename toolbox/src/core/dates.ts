export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  nextBirthday: string;
  daysUntilNextBirthday: number;
  asOf: string;
}

const MS_PER_DAY = 86_400_000;

/** Parses YYYY-MM-DD as a UTC calendar date. Throws on invalid or non-existent dates (e.g. 2025-02-30). */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new RangeError(`"${s}" is not a valid date; use YYYY-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`"${s}" is not a real calendar date`);
  }
  return date;
}

export const formatDate = (d: Date) => d.toISOString().slice(0, 10);
export const todayUTC = () => formatDate(new Date());

const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function calculateAge(birthDate: string, asOf: string = todayUTC()): AgeResult {
  const b = parseDate(birthDate);
  const t = parseDate(asOf);
  if (t < b) throw new RangeError("the reference date is before the birth date");

  let years = t.getUTCFullYear() - b.getUTCFullYear();
  let months = t.getUTCMonth() - b.getUTCMonth();
  let days = t.getUTCDate() - b.getUTCDate();
  if (days < 0) {
    // Borrow the length of the month preceding the reference date.
    const prev = t.getUTCMonth() === 0 ? 11 : t.getUTCMonth() - 1;
    const prevYear = t.getUTCMonth() === 0 ? t.getUTCFullYear() - 1 : t.getUTCFullYear();
    days += daysInMonth(prevYear, prev);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  // Next birthday; a Feb 29 birthday falls on Feb 28 in non-leap years.
  const bm = b.getUTCMonth();
  const bd = b.getUTCDate();
  const birthdayIn = (y: number) => new Date(Date.UTC(y, bm, Math.min(bd, daysInMonth(y, bm))));
  let next = birthdayIn(t.getUTCFullYear());
  if (next < t) next = birthdayIn(t.getUTCFullYear() + 1);
  // On the birthday itself "next" is today (0 days) — report the following one so the number is useful.
  if (diffDays(t, next) === 0 && years > 0) next = birthdayIn(t.getUTCFullYear() + 1);

  const totalDays = diffDays(b, t);
  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    totalMonths: years * 12 + months,
    nextBirthday: formatDate(next),
    daysUntilNextBirthday: diffDays(t, next),
    asOf: formatDate(t),
  };
}

export interface DaysBetweenResult {
  from: string;
  to: string;
  days: number;
  weeks: number;
  remainderDays: number;
  weekdays: number;
  approxMonths: number;
}

/** Signed difference; `inclusive` counts both endpoints. Weekdays are Mon–Fri, counted over the same span. */
export function daysBetween(from: string, to: string, inclusive = false): DaysBetweenResult {
  const a = parseDate(from);
  const b = parseDate(to);
  const sign = b >= a ? 1 : -1;
  const [lo, hi] = sign === 1 ? [a, b] : [b, a];
  const raw = diffDays(lo, hi) + (inclusive ? 1 : 0);

  let weekdays = 0;
  for (let i = 0; i < raw; i++) {
    const dow = new Date(lo.getTime() + i * MS_PER_DAY).getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }
  return {
    from: formatDate(a),
    to: formatDate(b),
    days: sign * raw,
    weeks: sign * Math.floor(raw / 7),
    remainderDays: raw % 7,
    weekdays: sign * weekdays,
    approxMonths: Math.round((sign * raw / 30.4375) * 10) / 10,
  };
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError("days must be an integer");
  return formatDate(new Date(parseDate(date).getTime() + days * MS_PER_DAY));
}

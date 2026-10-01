export interface TimelineInput {
  /** 24-hour "HH:MM". */
  ceremonyStart: string;
  ceremonyMinutes?: number;
  guestsArriveMinutesBefore?: number;
  photosMinutes?: number;
  /** Travel between ceremony and reception venues; 0 when they are the same place. */
  travelMinutes?: number;
  cocktailMinutes?: number;
  dinnerMinutes?: number;
  toastsMinutes?: number;
  firstDanceMinutes?: number;
  cakeMinutes?: number;
  danceMinutes?: number;
  /** Slack added between consecutive segments. */
  bufferMinutes?: number;
  /** "HH:MM": the venue must be empty by this time (next day if earlier than the ceremony). */
  venueCurfew?: string;
  /** "HH:MM": used to flag outdoor photos after sunset. */
  sunset?: string;
}
export interface Segment { name: string; start: string; end: string; minutes: number; day: number; note?: string }
export interface Timeline { segments: Segment[]; warnings: string[]; endTime: string; totalMinutes: number }

export function parseClock(s: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  if (!m) throw new RangeError(`"${s}" is not a valid 24-hour time; use HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}
export function formatClock(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function nonNegative(name: string, v: number) {
  if (!Number.isFinite(v) || v < 0 || v > 24 * 60) throw new RangeError(`${name} must be between 0 and 1440 minutes`);
}

export function buildTimeline(input: TimelineInput): Timeline {
  const d = {
    ceremonyMinutes: 30, guestsArriveMinutesBefore: 30, photosMinutes: 45, travelMinutes: 0, cocktailMinutes: 60, dinnerMinutes: 75,
    toastsMinutes: 20, firstDanceMinutes: 10, cakeMinutes: 15, danceMinutes: 120, bufferMinutes: 10, ...input,
  };
  for (const [k, v] of Object.entries(d)) if (typeof v === "number") nonNegative(k, v);
  const start = parseClock(input.ceremonyStart);
  const segs: { name: string; minutes: number; note?: string; gap?: number }[] = [];
  const add = (name: string, minutes: number, note?: string, gap = d.bufferMinutes) => { if (minutes > 0) segs.push({ name, minutes, note, gap }); };

  add("Guests arrive and are seated", d.guestsArriveMinutesBefore, undefined, 0);
  add("Ceremony", d.ceremonyMinutes);
  add("Family and couple photos", d.photosMinutes, "Guests can start the cocktail hour while you finish photos");
  if (d.travelMinutes > 0) add("Travel to reception", d.travelMinutes);
  add("Cocktail hour", d.cocktailMinutes);
  add("Grand entrance and dinner", d.dinnerMinutes);
  add("Toasts", d.toastsMinutes, undefined, 0);
  add("First dance", d.firstDanceMinutes);
  add("Cake cutting", d.cakeMinutes);
  add("Open dancing", d.danceMinutes);

  const out: Segment[] = [];
  let t = start - d.guestsArriveMinutesBefore;
  for (const s of segs) {
    out.push({ name: s.name, start: formatClock(t), end: formatClock(t + s.minutes), minutes: s.minutes, day: Math.floor(t / 1440), ...(s.note ? { note: s.note } : {}) });
    t += s.minutes + (s.gap ?? 0);
  }
  const endAbs = (() => {
    let tt = start - d.guestsArriveMinutesBefore;
    for (const [i, s] of segs.entries()) tt += s.minutes + (i === segs.length - 1 ? 0 : s.gap ?? 0);
    return tt;
  })();

  const warnings: string[] = [];
  if (input.venueCurfew) {
    let curfew = parseClock(input.venueCurfew);
    while (curfew <= start) curfew += 1440; // a curfew earlier than the ceremony is after midnight
    if (endAbs > curfew) warnings.push(`The schedule ends at ${formatClock(endAbs)}, ${endAbs - curfew} minutes after the ${formatClock(curfew)} curfew. Shorten dancing, dinner or buffers.`);
  }
  if (input.sunset) {
    const sun = parseClock(input.sunset);
    const photos = out.find((s) => s.name.startsWith("Family and couple photos"));
    if (photos) {
      const photoStartAbs = start + d.ceremonyMinutes + d.bufferMinutes;
      if (photoStartAbs + d.photosMinutes > sun) warnings.push(`Photos run until ${photos.end}, after sunset at ${formatClock(sun)}. Move the ceremony earlier or do portraits before the ceremony.`);
    }
  }
  if (d.travelMinutes > 0 && d.bufferMinutes < 10) warnings.push("Travel between venues has less than 10 minutes of slack; add a buffer for traffic.");
  if (endAbs - (start - d.guestsArriveMinutesBefore) > 12 * 60) warnings.push("The schedule runs longer than 12 hours.");
  return { segments: out, warnings, endTime: formatClock(endAbs), totalMinutes: endAbs - (start - d.guestsArriveMinutesBefore) };
}

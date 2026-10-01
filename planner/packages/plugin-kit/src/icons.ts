/** Square SVG icons drawn from a brand colour. Glyphs are simple on purpose so they stay legible at 48 px. */
export type Glyph = "room" | "table";

const glyph = (g: Glyph, c: string): string =>
  g === "room"
    ? `<rect x="30" y="34" width="68" height="60" rx="4" fill="none" stroke="${c}" stroke-width="7"/><rect x="40" y="62" width="34" height="18" rx="4" fill="${c}"/><path d="M82 94v-14" stroke="${c}" stroke-width="7"/>`
    : `<circle cx="64" cy="64" r="20" fill="none" stroke="${c}" stroke-width="7"/>${[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(64 + Math.cos(a) * 38).toFixed(1)}" cy="${(64 + Math.sin(a) * 38).toFixed(1)}" r="7" fill="${c}"/>`; }).join("")}`;

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>\n`;

/** Filled rounded square with the glyph in the foreground colour (listing logo). */
export const logoSvg = (g: Glyph, bg: string, fg: string) => svg(`<rect width="128" height="128" rx="28" fill="${bg}"/>${glyph(g, fg)}`);
/** Glyph alone on a transparent background (composer icon). */
export const composerSvg = (g: Glyph, color: string) => svg(glyph(g, color));

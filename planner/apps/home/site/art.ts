// Illustrative hero artwork: a to-scale living room (1 inch = 3 px). Replaced by real engine output later.
const S = 3, MX = 48, MY = 44;
const X = (x: number) => MX + x * S;
const Y = (y: number) => MY + y * S;
const rect = (cls: string, x: number, y: number, w: number, h: number, rx = 0) =>
  `<rect class="${cls}" x="${X(x)}" y="${Y(y)}" width="${w * S}" height="${h * S}"${rx ? ` rx="${rx}"` : ""}/>`;
const text = (t: string, x: number, y: number, cls = "", anchor = "middle") =>
  `<text${cls ? ` class="${cls}"` : ""} x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;

export function homeHeroSvg(): string {
  const W = 168, H = 144;
  const vbW = MX * 2 + W * S, vbH = MY + H * S + 56;
  const doorX0 = 96, doorX1 = 128;
  const parts = [
    rect("floor", 0, 0, W, H),
    rect("rug", 48, 34, 100, 72, 6),
    // walkway from the door and door swing
    rect("walk", 96, 40, 36, 72, 8),
    `<path class="swing" d="M ${X(doorX0)} ${Y(H)} A ${32 * S} ${32 * S} 0 0 1 ${X(doorX1)} ${Y(H - 32)} L ${X(doorX1)} ${Y(H)} Z"/>`,
    // furniture
    rect("item", 8, 30, 36, 84, 6),
    rect("item2", 8, 30, 10, 84, 4),
    rect("item2", 62, 56, 20, 40, 3),
    rect("item", 62, 8, 32, 32, 8),
    rect("item2", 152, 42, 16, 60, 3),
    rect("item", 8, 118, 18, 18, 3),
    // walls with door gap and window
    `<rect class="wall" x="${X(0)}" y="${Y(0)}" width="${W * S}" height="${H * S}"/>`,
    `<line x1="${X(doorX0)}" y1="${Y(H)}" x2="${X(doorX1)}" y2="${Y(H)}" stroke="var(--floor)" stroke-width="8"/>`,
    `<line class="win" x1="${X(54)}" y1="${Y(0)}" x2="${X(114)}" y2="${Y(0)}"/>`,
    // labels
    text("Sofa", X(26), Y(74) + 4, "", "middle").replace("<text", `<text transform="rotate(-90 ${X(26)} ${Y(74)})"`),
    text("Coffee table", X(72), Y(76) + 4).replace("<text", `<text transform="rotate(-90 ${X(72)} ${Y(76)})"`),
    text("Chair", X(78), Y(24) + 4),
    text("TV", X(160), Y(72) + 4).replace("<text", `<text transform="rotate(-90 ${X(160)} ${Y(72)})"`),
    text("36 in walkway", X(114), Y(76), "t-strong"),
    text("18 in", X(53), Y(54)),
    text("Door swing clear", X(112), Y(H) - 14 - 0),
    // dimensions
    `<line class="dim" x1="${X(0)}" y1="${MY - 20}" x2="${X(W)}" y2="${MY - 20}"/><line class="dim" x1="${X(0)}" y1="${MY - 26}" x2="${X(0)}" y2="${MY - 14}"/><line class="dim" x1="${X(W)}" y1="${MY - 26}" x2="${X(W)}" y2="${MY - 14}"/>`,
    text("14 ft", X(W / 2), MY - 26),
    `<line class="dim" x1="${MX - 20}" y1="${Y(0)}" x2="${MX - 20}" y2="${Y(H)}"/><line class="dim" x1="${MX - 26}" y1="${Y(0)}" x2="${MX - 14}" y2="${Y(0)}"/><line class="dim" x1="${MX - 26}" y1="${Y(H)}" x2="${MX - 14}" y2="${Y(H)}"/>`,
    `<text transform="rotate(-90 ${MX - 26} ${Y(H / 2)})" x="${MX - 26}" y="${Y(H / 2)}" text-anchor="middle">12 ft</text>`,
    // result badge
    `<rect class="badge" x="${vbW / 2 - 100}" y="${vbH - 44}" width="200" height="32" rx="16"/>`,
    `<text class="badge-t" x="${vbW / 2}" y="${vbH - 22}" text-anchor="middle">7 of 7 checks passed</text>`,
  ];
  return `<svg class="art" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="To-scale living room layout with sofa, coffee table, chair and TV unit; walkway and door swing are clear">${parts.join("")}</svg>`;
}

import { footprint, frontVector, swingZone, type Piece, type Placement, type Room, type LayoutReport } from "./layout.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface RenderOptions {
  /** Pixels per inch. */
  scale?: number;
  showLabels?: boolean;
  report?: LayoutReport;
  /** Piece ids to draw in the "problem" colour (rules failed). */
  highlight?: string[];
}

/**
 * Draws a to-scale plan as inline SVG using CSS classes (`rp-*`) so the host page controls colours.
 * Contains no user markup: every string is escaped.
 */
export function layoutToSvg(room: Room, pieces: Piece[], placements: Placement[], o: RenderOptions = {}): string {
  const S = o.scale ?? 3, M = 40;
  const W = room.width * S, H = room.length * S;
  const vbW = W + M * 2, vbH = H + M * 2 + (o.report ? 44 : 0);
  const X = (x: number) => M + x * S, Y = (y: number) => M + y * S;
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const out: string[] = [];
  out.push(`<rect class="rp-floor" x="${X(0)}" y="${Y(0)}" width="${W}" height="${H}"/>`);
  for (const op of room.openings) {
    const z = swingZone(room, op);
    if (z) {
      const r = op.width * S;
      const hinge: [number, number] = op.wall === "S" ? [X(op.offset + op.width), Y(room.length)] : op.wall === "N" ? [X(op.offset), Y(0)] : op.wall === "W" ? [X(0), Y(op.offset + op.width)] : [X(room.width), Y(op.offset)];
      const from: [number, number] = op.wall === "S" ? [X(op.offset), Y(room.length)] : op.wall === "N" ? [X(op.offset + op.width), Y(0)] : op.wall === "W" ? [X(0), Y(op.offset)] : [X(room.width), Y(op.offset + op.width)];
      const to: [number, number] = op.wall === "S" ? [X(op.offset + op.width), Y(room.length - op.width)] : op.wall === "N" ? [X(op.offset), Y(op.width)] : op.wall === "W" ? [X(op.width), Y(op.offset + op.width)] : [X(room.width - op.width), Y(op.offset)];
      const sweep = op.wall === "S" || op.wall === "N" ? 1 : 1;
      out.push(`<path class="rp-swing" d="M ${from[0]} ${from[1]} A ${r} ${r} 0 0 ${sweep} ${to[0]} ${to[1]} L ${hinge[0]} ${hinge[1]} Z"/>`);
    }
  }
  for (const pl of placements) {
    const p = byId.get(pl.id);
    if (!p) continue;
    const b = footprint(p, pl);
    const bad = o.highlight?.includes(p.id);
    const kind = p.kind ?? "generic";
    const [fx, fy] = frontVector(pl.rot);
    const w = (b.x1 - b.x0) * S, h = (b.y1 - b.y0) * S, x = X(b.x0), y = Y(b.y0);
    out.push(`<g class="rp-piece rp-${kind}${bad ? " rp-bad" : ""}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(6, w / 6, h / 6)}"/>`);
    // front marker: a short bar on the front edge
    const bar = 4;
    const mx = x + w / 2 + (fx * (w / 2 - bar / 2)), my = y + h / 2 + (fy * (h / 2 - bar / 2));
    out.push(`<rect class="rp-front" x="${fx ? mx - bar / 2 : mx - Math.min(w, 24) / 2}" y="${fy ? my - bar / 2 : my - Math.min(h, 24) / 2}" width="${fx ? bar : Math.min(w, 24)}" height="${fy ? bar : Math.min(h, 24)}"/>`);
    if (o.showLabels !== false && Math.min(w, h) > 14) {
      const vertical = h > w * 1.4;
      out.push(`<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle"${vertical ? ` transform="rotate(-90 ${x + w / 2} ${y + h / 2})"` : ""}>${esc(p.name)}</text>`);
    }
    out.push(`</g>`);
  }
  // walls, window and door gaps drawn last
  out.push(`<rect class="rp-wall" x="${X(0)}" y="${Y(0)}" width="${W}" height="${H}"/>`);
  for (const op of room.openings) {
    const [x1, y1, x2, y2] = op.wall === "N" ? [X(op.offset), Y(0), X(op.offset + op.width), Y(0)] : op.wall === "S" ? [X(op.offset), Y(room.length), X(op.offset + op.width), Y(room.length)] : op.wall === "W" ? [X(0), Y(op.offset), X(0), Y(op.offset + op.width)] : [X(room.width), Y(op.offset), X(room.width), Y(op.offset + op.width)];
    out.push(`<line class="rp-${op.type}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  // dimensions
  const ft = (n: number) => `${Math.floor(n / 12)} ft${n % 12 ? ` ${Math.round(n % 12)} in` : ""}`;
  out.push(`<text class="rp-dim" x="${X(room.width / 2)}" y="${M - 14}" text-anchor="middle">${ft(room.width)}</text>`);
  out.push(`<text class="rp-dim" x="${M - 14}" y="${Y(room.length / 2)}" text-anchor="middle" transform="rotate(-90 ${M - 14} ${Y(room.length / 2)})">${ft(room.length)}</text>`);
  if (o.report) {
    const label = `${o.report.passed} of ${o.report.total} checks passed`;
    out.push(`<rect class="rp-badge${o.report.ok ? "" : " rp-badge-bad"}" x="${vbW / 2 - 110}" y="${vbH - 38}" width="220" height="30" rx="15"/><text class="rp-badge-t" x="${vbW / 2}" y="${vbH - 18}" text-anchor="middle">${esc(label)}</text>`);
  }
  return `<svg class="rp-plan" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="${esc(`To-scale plan of a ${ft(room.width)} by ${ft(room.length)} room`)}">${out.join("")}</svg>`;
}

/** Default stylesheet for the plan; hosts may override the variables. */
export const PLAN_CSS = `.rp-plan{width:100%;height:auto;font:12px system-ui,sans-serif}
.rp-floor{fill:var(--rp-floor,#f1ece2)}.rp-wall{fill:none;stroke:var(--rp-wall,#1f2a2b);stroke-width:5}
.rp-swing{fill:var(--rp-accent,#c9633a);fill-opacity:.14;stroke:var(--rp-accent,#c9633a);stroke-dasharray:5 4}
.rp-window{stroke:var(--rp-window,#3a86c8);stroke-width:6}.rp-door{stroke:var(--rp-floor,#f1ece2);stroke-width:8}
.rp-piece rect:first-child{fill:var(--rp-item,#cfd9d6);stroke:var(--rp-item-line,#7d9490);stroke-width:1.5}
.rp-sofa rect:first-child,.rp-bed rect:first-child{fill:var(--rp-item-big,#b9c9c5)}
.rp-bad rect:first-child{fill:#f4c7c0;stroke:#b4412f;stroke-width:2.5}
.rp-front{fill:var(--rp-item-line,#7d9490)}
.rp-piece text{fill:var(--rp-text,#2a3a3b);font-size:11px;pointer-events:none}
.rp-dim{fill:var(--rp-muted,#5a6868);font-size:13px}
.rp-badge{fill:#2c7f52}.rp-badge-bad{fill:#b4412f}.rp-badge-t{fill:#fff;font-weight:700;font-size:14px}`;

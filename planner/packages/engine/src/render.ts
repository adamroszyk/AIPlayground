import { footprint, frontVector, swingZone, type Piece, type Placement, type Room, type LayoutReport } from "./layout.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pixels per inch and margin used by `layoutToSvg`, for converting pointer positions back to inches. */
export const PLAN_SCALE = 3;
export const PLAN_MARGIN = 40;

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
  const S = o.scale ?? PLAN_SCALE, M = PLAN_MARGIN;
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
    out.push(`<g class="rp-piece rp-${kind}${bad ? " rp-bad" : ""}" data-id="${esc(p.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(6, w / 6, h / 6)}"/>`);
    // front marker: a short bar on the front edge
    const bar = 4;
    const mx = x + w / 2 + (fx * (w / 2 - bar / 2)), my = y + h / 2 + (fy * (h / 2 - bar / 2));
    out.push(`<rect class="rp-front" x="${fx ? mx - bar / 2 : mx - Math.min(w, 24) / 2}" y="${fy ? my - bar / 2 : my - Math.min(h, 24) / 2}" width="${fx ? bar : Math.min(w, 24)}" height="${fy ? bar : Math.min(h, 24)}"/>`);
    if (o.showLabels !== false && Math.min(w, h) > 14) {
      const vertical = h > w * 1.4;
      const maxChars = Math.max(3, Math.floor((vertical ? h : w) / 6.4));
      const label = p.name.length > maxChars ? `${p.name.slice(0, maxChars - 1)}…` : p.name;
      out.push(`<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle"${vertical ? ` transform="rotate(-90 ${x + w / 2} ${y + h / 2})"` : ""}><title>${esc(p.name)}</title>${esc(label)}</text>`);
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
.rp-badge{fill:#2c7f52}.rp-badge-bad{fill:#b4412f}.rp-badge-t{fill:#fff;font-weight:700;font-size:14px}
.rp-wall,.rp-floor,.rp-swing,.rp-door,.rp-window,.rp-dim,.rp-badge,.rp-badge-t,.rp-front{pointer-events:none}`;

// ---------------------------------------------------------------------------------------------
// Seating chart renderer
// ---------------------------------------------------------------------------------------------
import type { Guest, SeatingReport, Table } from "./seating.ts";

export interface SeatingRenderOptions {
  report?: SeatingReport;
  /** Guest ids to draw in the "problem" colour. */
  highlight?: string[];
  columns?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0]! : parts[0]?.[1] ?? "")).toUpperCase();
}

/** Group labels in the order and with the colour classes `seatingToSvg` uses, for drawing a key. */
export function seatingGroups(guests: Guest[]): { group: string; cls: string }[] {
  const groups = [...new Set(guests.map((g) => g.group ?? ""))].filter((g) => g !== "");
  const all = [...new Set(guests.map((g) => g.group ?? ""))];
  return groups.map((group) => ({ group, cls: `rp-g${(all.indexOf(group) % 5) + 1}` }));
}

/** Round tables with colour-coded seats. Every string is escaped. `seats` lists guest ids per table in seat order. */
export function seatingToSvg(tables: Table[], guests: Guest[], seats: Record<string, string[]>, o: SeatingRenderOptions = {}): string {
  const byId = new Map(guests.map((g) => [g.id, g]));
  const all = [...new Set(guests.map((g) => g.group ?? ""))];
  const cls = (g: Guest) => `rp-g${(all.indexOf(g.group ?? "") % 5) + 1}`;
  const heads = tables.filter((t) => t.head), regular = tables.filter((t) => !t.head);
  const maxCap = Math.max(...regular.map((t) => t.capacity), 6);
  const ring = Math.max(52, maxCap * 6.4), cell = ring * 2 + 40;
  const cols = o.columns ?? Math.min(4, Math.max(1, Math.ceil(Math.sqrt(regular.length))));
  const rows = Math.ceil(regular.length / cols);
  const headW = (t: Table) => Math.max(100, t.capacity * 30);
  const HEAD_ROW = 110;
  const W = Math.max(cols * cell, ...heads.map((t) => headW(t) + 40));
  const headBlock = heads.length * HEAD_ROW;
  const H = headBlock + rows * cell + (o.report ? 50 : 0);
  const seat = (g: Guest | undefined, x: number, y: number, tid: string, k: number) =>
    g
      ? `<g class="rp-seatg" data-guest="${esc(g.id)}" data-table="${esc(tid)}" data-seat="${k}"><title>${esc(g.name)}</title><circle class="rp-seat ${cls(g)}${o.highlight?.includes(g.id) ? " rp-bad-seat" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/><text class="rp-init" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${esc(initials(g.name))}</text></g>`
      : `<circle class="rp-seat rp-empty" data-table="${esc(tid)}" data-seat="${k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12"/>`;
  const out: string[] = [];
  heads.forEach((t, i) => {
    const cx = W / 2, cy = 26 + i * HEAD_ROW, w = headW(t), ids = seats[t.id] ?? [];
    out.push(`<g class="rp-table rp-head" data-table="${esc(t.id)}"><rect class="rp-tbl" x="${cx - w / 2}" y="${cy - 16}" width="${w}" height="32" rx="8"/>`);
    for (let k = 0; k < t.capacity; k++) out.push(seat(byId.get(ids[k] ?? ""), cx - w / 2 + (w / t.capacity) * (k + 0.5), cy + 32, t.id, k));
    out.push(`<text class="rp-tname" x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(t.name ?? "Head table")}</text></g>`);
  });
  const gridX0 = (W - cols * cell) / 2;
  regular.forEach((t, i) => {
    const cx = gridX0 + (i % cols) * cell + cell / 2, cy = headBlock + Math.floor(i / cols) * cell + cell / 2;
    const ids = seats[t.id] ?? [];
    out.push(`<g class="rp-table" data-table="${esc(t.id)}"><circle class="rp-tbl" cx="${cx}" cy="${cy}" r="${ring * 0.62}"/>`);
    for (let k = 0; k < t.capacity; k++) {
      const a = (k / t.capacity) * Math.PI * 2 - Math.PI / 2;
      out.push(seat(byId.get(ids[k] ?? ""), cx + Math.cos(a) * ring * 0.95, cy + Math.sin(a) * ring * 0.95, t.id, k));
    }
    out.push(`<text class="rp-tname" x="${cx}" y="${cy - 2}" text-anchor="middle">${esc(t.name ?? t.id)}</text><text class="rp-tcount" x="${cx}" y="${cy + 14}" text-anchor="middle">${ids.length}/${t.capacity}</text></g>`);
  });
  if (o.report) {
    const label = `${o.report.passed} of ${o.report.total} rules met`;
    out.push(`<rect class="rp-badge${o.report.ok ? "" : " rp-badge-bad"}" x="${W / 2 - 110}" y="${H - 40}" width="220" height="30" rx="15"/><text class="rp-badge-t" x="${W / 2}" y="${H - 20}" text-anchor="middle">${esc(label)}</text>`);
  }
  return `<svg class="rp-seating" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Seating chart with ${tables.length} tables and ${guests.length} guests`)}">${out.join("")}</svg>`;
}

export const SEATING_CSS = `.rp-seating{width:100%;height:auto;font:12px system-ui,sans-serif}
.rp-tbl{fill:var(--rp-item,#efe3e1);stroke:var(--rp-item-line,#b79aa6);stroke-width:1.5}
.rp-seat{stroke:var(--rp-bg,#fff);stroke-width:1.5}.rp-empty{fill:none;stroke:var(--rp-item-line,#b79aa6);stroke-dasharray:3 3}
.rp-g1{fill:var(--rp-g1,#7b2d5b)}.rp-g2{fill:var(--rp-g2,#d98aa6)}.rp-g3{fill:var(--rp-g3,#3f8f8a)}.rp-g4{fill:var(--rp-g4,#c99a3e)}.rp-g5{fill:var(--rp-g5,#6b7fb3)}
.rp-bad-seat{stroke:#b4412f;stroke-width:3}
.rp-legend{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:12px;color:var(--rp-muted,#675b6c);margin:6px 0}.rp-legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.rp-legend .rp-g1{background:var(--rp-g1,#7b2d5b)}.rp-legend .rp-g2{background:var(--rp-g2,#d98aa6)}.rp-legend .rp-g3{background:var(--rp-g3,#3f8f8a)}.rp-legend .rp-g4{background:var(--rp-g4,#c99a3e)}.rp-legend .rp-g5{background:var(--rp-g5,#6b7fb3)}
.rp-init{fill:#fff;font-size:10px;font-weight:700;pointer-events:none}
.rp-tname{fill:var(--rp-text,#2a2230);font-weight:600;font-size:13px}.rp-tcount{fill:var(--rp-muted,#675b6c);font-size:12px}
.rp-badge{fill:#2c7f52}.rp-badge-bad{fill:#b4412f}.rp-badge-t{fill:#fff;font-weight:700;font-size:14px}
.rp-badge,.rp-badge-t,.rp-tname,.rp-tcount,.rp-init{pointer-events:none}`;

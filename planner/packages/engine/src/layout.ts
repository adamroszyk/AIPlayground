import { rng } from "./rng.ts";
import type { RuleResult } from "./seating.ts";

export type Wall = "N" | "E" | "S" | "W";
export interface Opening {
  id: string;
  type: "door" | "window";
  wall: Wall;
  /** Inches from the wall's start (west end of N/S walls, north end of E/W walls) to the opening's edge. */
  offset: number;
  width: number;
  /** Height in inches (default 80 for doors, 48 for windows). Used by the materials estimate. */
  height?: number;
  /** Doors only. "out" doors need no swing space inside the room. Default "in". */
  swing?: "in" | "out";
}
export interface Room {
  width: number; // x extent, inches
  length: number; // y extent, inches
  openings: Opening[];
}
export type Kind = "sofa" | "chair" | "coffee_table" | "side_table" | "tv" | "bed" | "nightstand" | "desk" | "dining_table" | "storage" | "generic";
export interface Piece {
  id: string;
  name: string;
  kind?: Kind;
  /** Width along the piece's own x axis, inches. */
  w: number;
  /** Depth (front to back), inches. */
  d: number;
  /** Tall pieces may not cover a window. */
  tall?: boolean;
}
export type Rot = 0 | 90 | 180 | 270;
/** (x, y) is the top-left corner of the piece's footprint. At rot 0 the front faces +y (south); 90 faces west; 180 north; 270 east. */
export interface Placement { id: string; x: number; y: number; rot: Rot }

export interface LayoutRules {
  mainWalkway: number;
  secondaryPath: number;
  sofaTableGap: [number, number];
  diningClearance: number;
  frontClearance: { storage: number; desk: number };
}
export const DEFAULT_RULES: LayoutRules = { mainWalkway: 36, secondaryPath: 30, sofaTableGap: [14, 18], diningClearance: 36, frontClearance: { storage: 30, desk: 36 } };

export interface LayoutReport { ok: boolean; passed: number; total: number; results: RuleResult[] }
export interface LayoutResult {
  status: "solved" | "partial";
  placements: Placement[];
  unplaced: string[];
  report: LayoutReport;
  stats: { restarts: number };
}

interface Box { x0: number; y0: number; x1: number; y1: number }
const kindOf = (p: Piece): Kind => p.kind ?? "generic";
const round1 = (n: number) => Math.round(n * 10) / 10;

export function footprint(p: Piece, pl: Placement): Box {
  const [dx, dy] = pl.rot === 0 || pl.rot === 180 ? [p.w, p.d] : [p.d, p.w];
  return { x0: pl.x, y0: pl.y, x1: pl.x + dx, y1: pl.y + dy };
}
export function frontVector(rot: Rot): [number, number] {
  return rot === 0 ? [0, 1] : rot === 90 ? [-1, 0] : rot === 180 ? [0, -1] : [1, 0];
}
const overlaps = (a: Box, b: Box, eps = 0.001) => a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;
const inflate = (b: Box, m: number): Box => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
const center = (b: Box): [number, number] => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

/** The space a door sweeps into the room (conservative square of side = door width). Empty for outward-swinging doors. */
export function swingZone(room: Room, o: Opening): Box | null {
  if (o.type !== "door" || o.swing === "out") return null;
  const { width: W, length: L } = room;
  switch (o.wall) {
    case "N": return { x0: o.offset, y0: 0, x1: o.offset + o.width, y1: o.width };
    case "S": return { x0: o.offset, y0: L - o.width, x1: o.offset + o.width, y1: L };
    case "W": return { x0: 0, y0: o.offset, x1: o.width, y1: o.offset + o.width };
    case "E": return { x0: W - o.width, y0: o.offset, x1: W, y1: o.offset + o.width };
  }
}
function windowStrip(room: Room, o: Opening, depth = 24): Box {
  const { width: W, length: L } = room;
  switch (o.wall) {
    case "N": return { x0: o.offset, y0: 0, x1: o.offset + o.width, y1: depth };
    case "S": return { x0: o.offset, y0: L - depth, x1: o.offset + o.width, y1: L };
    case "W": return { x0: 0, y0: o.offset, x1: depth, y1: o.offset + o.width };
    case "E": return { x0: W - depth, y0: o.offset, x1: W, y1: o.offset + o.width };
  }
}
/** A point just inside the room, in front of the door and beyond its swing. */
function doorAccess(room: Room, o: Opening): [number, number] {
  const depth = o.width + 6, mid = o.offset + o.width / 2;
  switch (o.wall) {
    case "N": return [mid, depth];
    case "S": return [mid, room.length - depth];
    case "W": return [depth, mid];
    case "E": return [room.width - depth, mid];
  }
}

// ---------------------------------------------------------------------------------------------
// Grid analysis: clearance field (distance to the nearest obstacle) and widest-path search.
// ---------------------------------------------------------------------------------------------
const CELL = 2; // inches

interface Grid { nx: number; ny: number; obstacle: Uint8Array }
function makeGrid(room: Room, boxes: Box[]): Grid {
  const nx = Math.ceil(room.width / CELL) + 2, ny = Math.ceil(room.length / CELL) + 2; // 1-cell wall padding
  const obstacle = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i - 1 + 0.5) * CELL, y = (j - 1 + 0.5) * CELL;
    let o = x < 0 || y < 0 || x > room.width || y > room.length;
    if (!o) for (const b of boxes) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) { o = true; break; }
    obstacle[j * nx + i] = o ? 1 : 0;
  }
  return { nx, ny, obstacle };
}
/** Clearance in inches from each free cell to the nearest obstacle edge (chamfer distance transform). */
function clearance(g: Grid): Float32Array {
  const { nx, ny, obstacle } = g;
  const d = new Float32Array(nx * ny);
  const INF = 1e9, D2 = Math.SQRT2;
  for (let k = 0; k < d.length; k++) d[k] = obstacle[k] ? 0 : INF;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (i > 0) d[k] = Math.min(d[k]!, d[k - 1]! + 1);
    if (j > 0) {
      d[k] = Math.min(d[k]!, d[k - nx]! + 1);
      if (i > 0) d[k] = Math.min(d[k]!, d[k - nx - 1]! + D2);
      if (i < nx - 1) d[k] = Math.min(d[k]!, d[k - nx + 1]! + D2);
    }
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    if (i < nx - 1) d[k] = Math.min(d[k]!, d[k + 1]! + 1);
    if (j < ny - 1) {
      d[k] = Math.min(d[k]!, d[k + nx]! + 1);
      if (i < nx - 1) d[k] = Math.min(d[k]!, d[k + nx + 1]! + D2);
      if (i > 0) d[k] = Math.min(d[k]!, d[k + nx - 1]! + D2);
    }
  }
  for (let k = 0; k < d.length; k++) d[k] = obstacle[k] ? 0 : Math.max(0, (d[k]! - 0.5) * CELL);
  return d;
}
const cellOf = (g: Grid, x: number, y: number) => {
  const i = Math.min(g.nx - 2, Math.max(1, Math.floor(x / CELL) + 1)), j = Math.min(g.ny - 2, Math.max(1, Math.floor(y / CELL) + 1));
  return j * g.nx + i;
};

/** Widest-path search: for each reachable cell, the largest "minimum clearance" over all paths from the start. */
function widest(g: Grid, clr: Float32Array, start: number): Float32Array {
  const best = new Float32Array(g.nx * g.ny).fill(-1);
  const heap: number[] = []; // cell ids, ordered by best[] descending
  const push = (c: number) => {
    heap.push(c);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (best[heap[p]!]! >= best[heap[i]!]!) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && best[heap[l]!]! > best[heap[m]!]!) m = l;
        if (r < heap.length && best[heap[r]!]! > best[heap[m]!]!) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  best[start] = clr[start]!;
  push(start);
  const done = new Uint8Array(best.length);
  while (heap.length) {
    const c = pop();
    if (done[c]) continue;
    done[c] = 1;
    const ci = c % g.nx, cj = (c - ci) / g.nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.ny) continue;
      const n = nj * g.nx + ni;
      if (g.obstacle[n] || done[n]) continue;
      const v = Math.min(best[c]!, clr[n]!);
      if (v > best[n]!) {
        best[n] = v;
        push(n);
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------------------------
export function verifyLayout(room: Room, pieces: Piece[], placements: Placement[], rules: Partial<LayoutRules> = {}): LayoutReport {
  const R: LayoutRules = { ...DEFAULT_RULES, ...rules, frontClearance: { ...DEFAULT_RULES.frontClearance, ...rules.frontClearance } };
  const results: RuleResult[] = [];
  const push = (id: string, kind: string, description: string, ok: boolean, detail: string) => results.push({ id, kind, description, ok, detail });
  const pieceById = new Map(pieces.map((p) => [p.id, p]));
  const plById = new Map(placements.map((p) => [p.id, p]));
  const missing = pieces.filter((p) => !plById.has(p.id)).map((p) => p.name);
  const placed = placements.filter((pl) => pieceById.has(pl.id));
  const box = new Map(placed.map((pl) => [pl.id, footprint(pieceById.get(pl.id)!, pl)]));
  const name = (id: string) => pieceById.get(id)?.name ?? id;

  push("all-placed", "builtin", "Every piece has a place", missing.length === 0, missing.length ? `Not placed: ${missing.join(", ")}` : `${placed.length} pieces placed`);

  const outside = placed.filter((pl) => { const b = box.get(pl.id)!; return b.x0 < -0.001 || b.y0 < -0.001 || b.x1 > room.width + 0.001 || b.y1 > room.length + 0.001; });
  push("inside-room", "builtin", "Everything stays inside the walls", outside.length === 0, outside.length ? `Outside the room: ${outside.map((p) => name(p.id)).join(", ")}` : "All inside");

  const clashes: string[] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++)
    if (overlaps(box.get(placed[i]!.id)!, box.get(placed[j]!.id)!)) clashes.push(`${name(placed[i]!.id)} and ${name(placed[j]!.id)}`);
  push("no-overlap", "builtin", "Nothing overlaps", clashes.length === 0, clashes.length ? `Overlapping: ${clashes.join("; ")}` : "No overlaps");

  const doors = room.openings.filter((o) => o.type === "door");
  const swingHits: string[] = [];
  for (const o of doors) {
    const z = swingZone(room, o);
    if (z) for (const pl of placed) if (overlaps(box.get(pl.id)!, z)) swingHits.push(`${name(pl.id)} blocks the swing of ${o.id}`);
  }
  if (doors.some((o) => o.swing !== "out")) push("door-swing", "door", "Door swings stay clear", swingHits.length === 0, swingHits.length ? swingHits.join("; ") : "All door swings clear");

  const windows = room.openings.filter((o) => o.type === "window");
  if (windows.length && pieces.some((p) => p.tall)) {
    const hits: string[] = [];
    for (const w of windows) for (const pl of placed) if (pieceById.get(pl.id)!.tall && overlaps(box.get(pl.id)!, windowStrip(room, w))) hits.push(`${name(pl.id)} covers ${w.id}`);
    push("window-clear", "window", "Tall pieces do not block a window", hits.length === 0, hits.length ? hits.join("; ") : "Windows clear");
  }

  // Walkways ---------------------------------------------------------------------------------
  if (doors.length) {
    const boxes = placed.map((pl) => box.get(pl.id)!);
    const grid = makeGrid(room, boxes);
    const clr = clearance(grid);
    const accessCell = (o: Opening) => { const [x, y] = doorAccess(room, o); return cellOf(grid, x, y); };
    // Main walkway: doors to each other, and the first door to the most open floor.
    let hub = -1, hubClr = -1;
    for (let k = 0; k < clr.length; k++) if (!grid.obstacle[k] && clr[k]! > hubClr) { hubClr = clr[k]!; hub = k; }
    const first = doors[0]!;
    const w0 = widest(grid, clr, accessCell(first));
    const mainWidth = hub >= 0 ? 2 * Math.max(0, Math.min(w0[hub]!, hubClr)) : 0;
    let narrow = mainWidth;
    const otherDoors: string[] = [];
    for (const o of doors.slice(1)) {
      const wd = 2 * Math.max(0, w0[accessCell(o)]!);
      otherDoors.push(`${first.id} to ${o.id}: ${round1(wd)} in`);
      narrow = Math.min(narrow, wd);
    }
    push("main-walkway", "walkway", `Main walkway at least ${R.mainWalkway} in wide`, narrow >= R.mainWalkway - 0.001, `Narrowest point on the main route: ${round1(narrow)} in${otherDoors.length ? ` (${otherDoors.join("; ")})` : ""}`);

    // Every seating piece can be reached (secondary path width).
    const seating = placed.filter((pl) => ["sofa", "chair", "bed", "desk"].includes(kindOf(pieceById.get(pl.id)!)));
    const reach: string[] = [];
    let minReach = Infinity;
    for (const pl of seating) {
      const g2 = makeGrid(room, placed.filter((o) => o.id !== pl.id).map((o) => box.get(o.id)!));
      const c2 = clearance(g2);
      const start = cellOf(g2, doorAccess(room, first)[0], doorAccess(room, first)[1]);
      const wide = widest(g2, c2, start);
      const b = box.get(pl.id)!, ring = inflate(b, 24);
      let bestW = 0;
      for (let j = 1; j < g2.ny - 1; j++) for (let i = 1; i < g2.nx - 1; i++) {
        const x = (i - 0.5) * CELL, y = (j - 0.5) * CELL;
        if (x < ring.x0 || x > ring.x1 || y < ring.y0 || y > ring.y1) continue;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) continue;
        const v = wide[j * g2.nx + i]!;
        if (v > bestW) bestW = v;
      }
      const width = 2 * bestW;
      minReach = Math.min(minReach, width);
      if (width < R.secondaryPath - 0.001) reach.push(`${name(pl.id)} (${round1(width)} in)`);
    }
    if (seating.length) push("seat-access", "walkway", `You can walk to every seat or bed on a path at least ${R.secondaryPath} in wide`, reach.length === 0, reach.length ? `Hard to reach: ${reach.join("; ")}` : `Narrowest approach: ${round1(minReach)} in`);
  }

  // Pair and clearance rules ---------------------------------------------------------------------
  const sofas = placed.filter((pl) => kindOf(pieceById.get(pl.id)!) === "sofa");
  const tables = placed.filter((pl) => kindOf(pieceById.get(pl.id)!) === "coffee_table");
  const gapMsgs: string[] = [];
  let gapOk = true, anyGap = false;
  for (const t of tables) {
    const tb = box.get(t.id)!;
    let best: { gap: number; sofa: string } | null = null;
    for (const s of sofas) {
      const sb = box.get(s.id)!, [fx, fy] = frontVector(s.rot);
      let gap = NaN, lateral = 0;
      if (fy === 1) { gap = tb.y0 - sb.y1; lateral = Math.min(sb.x1, tb.x1) - Math.max(sb.x0, tb.x0); }
      if (fy === -1) { gap = sb.y0 - tb.y1; lateral = Math.min(sb.x1, tb.x1) - Math.max(sb.x0, tb.x0); }
      if (fx === 1) { gap = tb.x0 - sb.x1; lateral = Math.min(sb.y1, tb.y1) - Math.max(sb.y0, tb.y0); }
      if (fx === -1) { gap = sb.x0 - tb.x1; lateral = Math.min(sb.y1, tb.y1) - Math.max(sb.y0, tb.y0); }
      if (gap >= -0.001 && gap <= 48 && lateral > 0 && (!best || gap < best.gap)) best = { gap, sofa: s.id };
    }
    if (best) {
      anyGap = true;
      const ok = best.gap >= R.sofaTableGap[0] - 0.001 && best.gap <= R.sofaTableGap[1] + 0.001;
      gapOk &&= ok;
      gapMsgs.push(`${name(best.sofa)} to ${name(t.id)}: ${round1(best.gap)} in`);
    }
  }
  if (anyGap) push("sofa-table-gap", "pair", `Sofa to coffee table ${R.sofaTableGap[0]} to ${R.sofaTableGap[1]} in`, gapOk, gapMsgs.join("; "));

  const dining = placed.filter((pl) => kindOf(pieceById.get(pl.id)!) === "dining_table");
  if (dining.length) {
    const bad: string[] = [];
    let minC = Infinity;
    for (const d of dining) {
      const zone = inflate(box.get(d.id)!, R.diningClearance);
      const wallRoom = Math.min(box.get(d.id)!.x0, box.get(d.id)!.y0, room.width - box.get(d.id)!.x1, room.length - box.get(d.id)!.y1);
      let c = wallRoom;
      for (const o of placed) if (o.id !== d.id && kindOf(pieceById.get(o.id)!) !== "chair") {
        const ob = box.get(o.id)!, db = box.get(d.id)!;
        const gx = Math.max(ob.x0 - db.x1, db.x0 - ob.x1, 0), gy = Math.max(ob.y0 - db.y1, db.y0 - ob.y1, 0);
        c = Math.min(c, Math.hypot(gx, gy) > 0 ? Math.max(gx, gy) : 0);
      }
      minC = Math.min(minC, c);
      if (zone.x0 < -0.001 || zone.y0 < -0.001 || zone.x1 > room.width + 0.001 || zone.y1 > room.length + 0.001 || placed.some((o) => o.id !== d.id && kindOf(pieceById.get(o.id)!) !== "chair" && overlaps(box.get(o.id)!, zone))) bad.push(name(d.id));
    }
    push("dining-clearance", "pair", `Dining table has ${R.diningClearance} in all round for chairs`, bad.length === 0, bad.length ? `Too tight: ${bad.join(", ")}` : `At least ${R.diningClearance} in on every side`);
  }

  for (const kind of ["storage", "desk"] as const) {
    const items = placed.filter((pl) => kindOf(pieceById.get(pl.id)!) === kind);
    if (!items.length) continue;
    const need = R.frontClearance[kind];
    const bad: string[] = [];
    for (const it of items) {
      const b = box.get(it.id)!, [fx, fy] = frontVector(it.rot);
      const zone: Box = { x0: fx === 1 ? b.x1 : fx === -1 ? b.x0 - need : b.x0, x1: fx === 1 ? b.x1 + need : fx === -1 ? b.x0 : b.x1, y0: fy === 1 ? b.y1 : fy === -1 ? b.y0 - need : b.y0, y1: fy === 1 ? b.y1 + need : fy === -1 ? b.y0 : b.y1 };
      const out = zone.x0 < -0.001 || zone.y0 < -0.001 || zone.x1 > room.width + 0.001 || zone.y1 > room.length + 0.001;
      if (out || placed.some((o) => o.id !== it.id && overlaps(box.get(o.id)!, zone))) bad.push(name(it.id));
    }
    push(`${kind}-front`, "pair", `${kind === "desk" ? "Desks" : "Storage"} have ${need} in free in front`, bad.length === 0, bad.length ? `Blocked in front: ${bad.join(", ")}` : "Fronts clear");
  }

  const passed = results.filter((r) => r.ok).length;
  return { ok: passed === results.length, passed, total: results.length, results };
}

// ---------------------------------------------------------------------------------------------
// Placement solver
// ---------------------------------------------------------------------------------------------
const PRIORITY: Record<Kind, number> = { sofa: 0, bed: 0, dining_table: 0, tv: 1, coffee_table: 2, desk: 3, chair: 4, storage: 5, nightstand: 6, side_table: 6, generic: 7 };
const WALL_KINDS = new Set<Kind>(["sofa", "bed", "tv", "storage", "desk", "nightstand"]);

function wallDistance(room: Room, b: Box): number {
  return Math.min(b.x0, b.y0, room.width - b.x1, room.length - b.y1);
}
function gapBetween(a: Box, b: Box): number {
  const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), gy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
  return gx > 0 && gy > 0 ? Math.hypot(gx, gy) : Math.max(gx, gy);
}

function scoreCandidate(room: Room, piece: Piece, pl: Placement, placed: { piece: Piece; pl: Placement }[], rules: LayoutRules): number {
  const kind = kindOf(piece), b = footprint(piece, pl), [cx, cy] = center(b);
  const [fx, fy] = frontVector(pl.rot);
  const roomC: [number, number] = [room.width / 2, room.length / 2];
  let s = 0;
  const wd = wallDistance(room, b);
  if (WALL_KINDS.has(kind)) {
    s += wd <= 1 ? 40 : -wd * 0.5;
    // do not park big pieces on a wall that has a door in it
    const doorWalls = new Set(room.openings.filter((o) => o.type === "door").map((o) => o.wall));
    const touching: Wall[] = [];
    if (b.y0 <= 1) touching.push("N");
    if (b.y1 >= room.length - 1) touching.push("S");
    if (b.x0 <= 1) touching.push("W");
    if (b.x1 >= room.width - 1) touching.push("E");
    if (["sofa", "bed", "tv"].includes(kind) && touching.some((w) => doorWalls.has(w))) s -= 12;
  }
  else if (kind === "dining_table") s += Math.min(wd, 60) * 0.2;
  // face the room (or the focal piece)
  const toC = [roomC[0] - cx, roomC[1] - cy], len = Math.hypot(toC[0]!, toC[1]!) || 1;
  const cosC = (fx * toC[0]! + fy * toC[1]!) / len;
  if (["sofa", "tv", "storage", "desk", "bed"].includes(kind)) s += 14 * cosC;
  // relations to already placed pieces
  for (const o of placed) {
    const ok = kindOf(o.piece), ob = footprint(o.piece, o.pl), [ox, oy] = center(ob);
    const g = gapBetween(b, ob);
    if (kind === "tv" && ok === "sofa") {
      const toS = [ox - cx, oy - cy], l = Math.hypot(toS[0]!, toS[1]!) || 1;
      s += 24 * ((fx * toS[0]! + fy * toS[1]!) / l);
      const dist = Math.hypot(ox - cx, oy - cy);
      s += dist >= 84 && dist <= 168 ? 16 : -Math.abs(dist - 120) * 0.2;
    }
    if (kind === "coffee_table" && ok === "sofa") {
      const [sx, sy] = frontVector(o.pl.rot);
      const along = (cx - ox) * sx + (cy - oy) * sy, lateral = Math.abs((cx - ox) * -sy + (cy - oy) * sx);
      const [lo, hi] = rules.sofaTableGap;
      const facing = along > 0 && gapBetween(b, ob) <= 48;
      if (facing) s += g >= lo && g <= hi ? 70 : -Math.abs(g - (lo + hi) / 2) * 3;
      s -= lateral * 0.6;
    }
    if (kind === "chair" && ok === "coffee_table") {
      const toT = [ox - cx, oy - cy], l = Math.hypot(toT[0]!, toT[1]!) || 1;
      s += 18 * ((fx * toT[0]! + fy * toT[1]!) / l);
      const sideOn = Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0) > 0 || Math.min(b.y1, ob.y1) - Math.max(b.y0, ob.y0) > 0;
      s += g >= 14 && g <= 30 ? 25 : -Math.abs(g - 22) * 0.6;
      s += sideOn ? 20 : 0;
    }
    if ((kind === "nightstand" || kind === "side_table") && (ok === "bed" || ok === "sofa")) {
      // beside the piece (at its end), not in front of or behind it
      const [, oy2] = frontVector(o.pl.rot);
      const lateralGap = oy2 !== 0 ? Math.max(b.x0 - ob.x1, ob.x0 - b.x1) : Math.max(b.y0 - ob.y1, ob.y0 - b.y1);
      const alongOverlap = oy2 !== 0 ? Math.min(b.y1, ob.y1) - Math.max(b.y0, ob.y0) : Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0);
      s += lateralGap >= 0 && lateralGap <= 4 && alongOverlap > 0 ? 35 : -Math.min(g, 60) * 0.4;
    }
    if (g > 0 && g < 10 && !(kind === "nightstand" || kind === "side_table" || ok === "nightstand" || ok === "side_table")) s -= 14; // unusable slivers
    if (kind === "dining_table") s += Math.min(g, 48) * 0.3;
  }
  // keep a corridor from each door to the middle of the room open
  for (const o of room.openings) {
    if (o.type !== "door") continue;
    const [ax, ay] = doorAccess(room, o);
    const c: Box = { x0: Math.min(ax, roomC[0]) - 18, x1: Math.max(ax, roomC[0]) + 18, y0: Math.min(ay, roomC[1]) - 18, y1: Math.max(ay, roomC[1]) + 18 };
    if (overlaps(b, c)) s -= 30;
    if (gapBetween(b, { x0: ax - 1, y0: ay - 1, x1: ax + 1, y1: ay + 1 }) < 20) s -= 25;
  }
  return s;
}

export interface LayoutOptions { seed?: number; restarts?: number; rules?: Partial<LayoutRules> }

export function solveLayout(room: Room, pieces: Piece[], options: LayoutOptions = {}): LayoutResult {
  const R: LayoutRules = { ...DEFAULT_RULES, ...options.rules, frontClearance: { ...DEFAULT_RULES.frontClearance, ...options.rules?.frontClearance } };
  const restarts = options.restarts ?? 10;
  const seed = options.seed ?? 1;
  const order = [...pieces].sort((a, b) => PRIORITY[kindOf(a)] - PRIORITY[kindOf(b)] || b.w * b.d - a.w * a.d);
  const zones = room.openings.map((o) => swingZone(room, o)).filter((z): z is Box => !!z);
  const strips = room.openings.filter((o) => o.type === "window").map((o) => windowStrip(room, o));
  let bestResult: LayoutResult | null = null;

  for (let r = 0; r < restarts; r++) {
    const rand = rng(seed + r * 104729);
    const placed: { piece: Piece; pl: Placement }[] = [];
    const unplaced: string[] = [];
    for (const piece of order) {
      const cands: { pl: Placement; s: number }[] = [];
      for (const rot of [0, 90, 180, 270] as Rot[]) {
        const [dx, dy] = rot === 0 || rot === 180 ? [piece.w, piece.d] : [piece.d, piece.w];
        if (dx > room.width || dy > room.length) continue;
        const xs = new Set<number>([0, room.width - dx]), ys = new Set<number>([0, room.length - dy]);
        for (let x = 0; x <= room.width - dx; x += 6) xs.add(x);
        for (let y = 0; y <= room.length - dy; y += 6) ys.add(y);
        for (const x of xs) for (const y of ys) {
          const pl: Placement = { id: piece.id, x, y, rot };
          const b = footprint(piece, pl);
          if (zones.some((z) => overlaps(b, z))) continue;
          if (piece.tall && strips.some((z) => overlaps(b, z))) continue;
          if (placed.some((o) => overlaps(b, footprint(o.piece, o.pl)))) continue;
          cands.push({ pl, s: scoreCandidate(room, piece, pl, placed, R) });
        }
      }
      if (!cands.length) { unplaced.push(piece.id); continue; }
      cands.sort((a, b) => b.s - a.s);
      const pickFrom = Math.min(cands.length, r === 0 ? 1 : 1 + Math.floor(rand() * 4));
      placed.push({ piece, pl: cands[Math.floor(rand() * pickFrom)]!.pl });
    }
    const placements = placed.map((p) => p.pl);
    const report = verifyLayout(room, pieces, placements, R);
    const fails = report.total - report.passed;
    const prevFails = bestResult ? bestResult.report.total - bestResult.report.passed : Infinity;
    if (!bestResult || fails < prevFails || (fails === prevFails && unplaced.length < bestResult.unplaced.length)) {
      bestResult = { status: unplaced.length === 0 && report.ok ? "solved" : "partial", placements, unplaced, report, stats: { restarts: r + 1 } };
    }
    if (bestResult.status === "solved") break;
  }
  return bestResult!;
}

import { copyText, downloadFile, el, field, num, parseLocation, planApi, setStatus } from "@planner/editor-kit";
import {
  FURNITURE_PRESETS, PLAN_CSS, PLAN_MARGIN, PLAN_SCALE, estimateMaterials, footprint, fromInches, layoutToSvg, solveLayout, toInches, verifyLayout,
  type LayoutReport, type Opening, type Piece, type Placement, type Room, type Rot, type Unit,
} from "@planner/engine";
import type { RoomPlan } from "../src/model.ts";

interface Mat { heightIn: number; coats: number; ceiling: boolean; pricePerGallon?: number; pricePerSqFt?: number }
interface State {
  unit: Unit;
  room: Room;
  pieces: Piece[];
  placements: Placement[];
  report?: LayoutReport;
  status: "draft" | "solved" | "partial";
  unplaced: string[];
  selected?: string;
  id?: string;
  token?: string;
  dirty: boolean;
  readOnly: boolean;
  mat: Mat;
  nextId: number;
}

const KINDS = ["sofa", "chair", "coffee_table", "side_table", "tv", "bed", "nightstand", "desk", "dining_table", "storage", "generic"];
const WALLS = [["N", "North wall (top)"], ["E", "East wall (right)"], ["S", "South wall (bottom)"], ["W", "West wall (left)"]] as const;

const state: State = {
  unit: "ft",
  room: { width: 168, length: 144, openings: [{ id: "door1", type: "door", wall: "S", offset: 96, width: 32, swing: "in" }, { id: "window1", type: "window", wall: "N", offset: 54, width: 60 }] },
  pieces: [],
  placements: [],
  status: "draft",
  unplaced: [],
  dirty: false,
  readOnly: false,
  mat: { heightIn: 96, coats: 2, ceiling: false },
  nextId: 1,
};

const root = document.getElementById("app")!;
const side = el("aside", { id: "side" });
const main = el("section", { id: "main" });
root.replaceChildren(side, main);

const U = () => state.unit;
/** Room sizes use the chosen unit; openings and furniture use inches (or centimetres for metric), how they are usually quoted. */
const SU = (): Unit => (U() === "ft" || U() === "in" ? "in" : "cm");
const unitFor = (small: boolean): Unit => (small ? SU() : U());
const show = (inches: number, small = false) => fromInches(inches, unitFor(small));
const read = (v: string, fallback: number, small = false) => toInches(num(v, fallback), unitFor(small));
const addPiece = (name: string, kind: string, w: number, d: number, tall?: boolean) => {
  state.pieces.push({ id: `p${state.nextId++}`, name, kind: kind as Piece["kind"], w, d, ...(tall ? { tall: true } : {}) });
};

// ---------------------------------------------------------------------------------------------
// Validation, solving and verification
// ---------------------------------------------------------------------------------------------
function validate(): string | null {
  const { room } = state;
  if (!(room.width >= 36 && room.width <= 720 && room.length >= 36 && room.length <= 720)) return "The room must be between 3 ft and 60 ft on each side.";
  for (const o of room.openings) {
    const wallLen = o.wall === "N" || o.wall === "S" ? room.width : room.length;
    if (o.width < 12 || o.width > 120) return `A ${o.type} must be between 12 in and 10 ft wide.`;
    if (o.offset < 0 || o.offset + o.width > wallLen + 0.01) return `The ${o.type} on the ${o.wall} wall does not fit on that wall.`;
  }
  if (state.pieces.length === 0) return "Add at least one piece of furniture.";
  if (state.pieces.length > 25) return "Up to 25 pieces of furniture.";
  for (const p of state.pieces) if (!(p.w >= 6 && p.w <= 240 && p.d >= 6 && p.d <= 240) || !p.name.trim()) return `${p.name || "A piece"}: give it a name and sizes between 6 in and 20 ft.`;
  return null;
}

function verify() {
  if (state.placements.length === 0) { state.report = undefined; return; }
  state.report = verifyLayout(state.room, state.pieces, state.placements);
  state.unplaced = state.pieces.filter((p) => !state.placements.some((pl) => pl.id === p.id)).map((p) => p.id);
  state.status = state.report.ok ? "solved" : "partial";
}

function planLayout() {
  const bad = validate();
  if (bad) { setStatus(statusEl(), bad, "err"); return; }
  const res = solveLayout(state.room, state.pieces, { seed: 1, restarts: 14 });
  state.placements = res.placements;
  state.report = res.report;
  state.status = res.status;
  state.unplaced = res.unplaced;
  state.selected = undefined;
  state.dirty = true;
  renderMain();
  setStatus(statusEl(), res.status === "solved" ? "Layout found. Drag pieces to adjust; the checks update as you move them." : "Best layout found, but not every check passes. See the list.", res.status === "solved" ? "ok" : "");
}

/** A structural edit (room, openings, furniture) invalidates the arrangement until the layout is planned again. */
function structural() {
  state.placements = [];
  state.report = undefined;
  state.status = "draft";
  state.dirty = true;
  state.selected = undefined;
  renderMain();
  setStatus(statusEl(), "Room or furniture changed. Press “Plan layout” to arrange the furniture again.", "");
}

// ---------------------------------------------------------------------------------------------
// Side panel: room, openings, furniture, materials
// ---------------------------------------------------------------------------------------------
function numInput(value: number, onChange: (inches: number) => void, small = false, min = 0): HTMLInputElement {
  const u = unitFor(small);
  const i = el("input", { type: "number", value: show(value, small), step: u === "ft" || u === "m" ? "0.1" : "1", min, inputMode: "decimal" });
  i.disabled = state.readOnly;
  i.addEventListener("change", () => onChange(read(i.value, value, small)));
  return i;
}
const unitLabel = (small: boolean) => ({ in: "in", ft: "ft", cm: "cm", m: "m" })[unitFor(small)];
function select(options: readonly (readonly [string, string])[] | string[], value: string, onChange: (v: string) => void): HTMLSelectElement {
  const s = el("select", {}, ...options.map((o) => { const [v, t] = typeof o === "string" ? [o, o.replace("_", " ")] : o; return el("option", { value: v, text: t, selected: v === value }); }));
  s.disabled = state.readOnly;
  s.addEventListener("change", () => onChange(s.value));
  return s;
}

function renderSide() {
  const dis = state.readOnly;
  const unitSel = select([["ft", "Feet"], ["in", "Inches"], ["m", "Metres"], ["cm", "Centimetres"]], U(), (v) => { state.unit = v as Unit; renderSide(); renderMain(); });
  unitSel.disabled = false;

  const roomPanel = el("div", { class: "panel" }, el("h2", { text: "Room" }),
    field("Units", unitSel),
    el("div", { class: "row" },
      field(`West–east (width, ${unitLabel(false)})`, numInput(state.room.width, (v) => { state.room.width = v; structural(); })),
      field(`North–south (length, ${unitLabel(false)})`, numInput(state.room.length, (v) => { state.room.length = v; structural(); }))),
    el("p", { class: "help", text: "North is the top of the plan. Measure wall to wall." }));

  const openingRows = state.room.openings.map((o, i) =>
    el("div", { class: "panel" },
      el("div", { class: "row" },
        field("Type", select(["door", "window"], o.type, (v) => { o.type = v as Opening["type"]; structural(); })),
        field("Wall", select(WALLS, o.wall, (v) => { o.wall = v as Opening["wall"]; structural(); }))),
      el("div", { class: "row" },
        field(`From corner (${unitLabel(true)})`, numInput(o.offset, (v) => { o.offset = v; structural(); }, true)),
        field(`Width (${unitLabel(true)})`, numInput(o.width, (v) => { o.width = v; structural(); }, true)),
        (() => { const b = el("button", { class: "secondary", type: "button", text: "Remove", disabled: dis }); b.onclick = () => { state.room.openings.splice(i, 1); renderSide(); structural(); }; return b; })())));
  const addDoor = el("button", { class: "secondary", type: "button", text: "Add door", disabled: dis });
  addDoor.onclick = () => { state.room.openings.push({ id: `door${state.nextId++}`, type: "door", wall: "S", offset: 12, width: 32, swing: "in" }); renderSide(); structural(); };
  const addWin = el("button", { class: "secondary", type: "button", text: "Add window", disabled: dis });
  addWin.onclick = () => { state.room.openings.push({ id: `window${state.nextId++}`, type: "window", wall: "N", offset: 12, width: 48 }); renderSide(); structural(); };
  const openPanel = el("div", { class: "panel" }, el("h2", { text: "Doors and windows" }), ...openingRows, el("div", { class: "toolbar" }, addDoor, addWin),
    el("p", { class: "help", text: "“From corner” is measured from the west end of a north or south wall, or the north end of an east or west wall." }));

  const pieceRows = state.pieces.map((p, i) => {
    const name = el("input", { type: "text", value: p.name, maxLength: 60 }); name.disabled = dis;
    name.addEventListener("change", () => { p.name = name.value; state.report && verify(); renderMain(); state.dirty = true; });
    const rm = el("button", { class: "secondary", type: "button", text: "Remove", disabled: dis });
    rm.onclick = () => { state.pieces.splice(i, 1); renderSide(); structural(); };
    const tall = el("input", { type: "checkbox", checked: !!p.tall }); tall.disabled = dis;
    tall.addEventListener("change", () => { p.tall = tall.checked || undefined; structural(); });
    return el("div", { class: "panel" },
      el("div", { class: "row" }, field("Name", name), field("Type", select(KINDS, p.kind ?? "generic", (v) => { p.kind = v as Piece["kind"]; structural(); }))),
      el("div", { class: "row" }, field(`Width (${unitLabel(true)})`, numInput(p.w, (v) => { p.w = v; structural(); }, true)), field(`Depth (${unitLabel(true)})`, numInput(p.d, (v) => { p.d = v; structural(); }, true)),
        el("label", { class: "help" }, tall, " Tall (keep off windows)"), rm));
  });
  const preset = select([["", "Add a piece…"], ...FURNITURE_PRESETS.map((f, i) => [String(i), `${f.name} (${f.w}×${f.d} in)`] as const), ["custom", "Custom piece"]], "", (v) => {
    if (!v) return;
    if (v === "custom") addPiece("New piece", "generic", 30, 20); else { const f = FURNITURE_PRESETS[Number(v)]!; addPiece(f.name, f.kind, f.w, f.d, f.tall); }
    renderSide(); structural();
  });
  const furniturePanel = el("div", { class: "panel" }, el("h2", { text: "Furniture" }), ...(pieceRows.length ? pieceRows : [el("p", { class: "help", text: "Add the pieces you want in the room." })]), field("", preset),
    el("p", { class: "help", text: "Sizes are front-to-back (depth) and side-to-side (width)." }));

  const m = state.mat;
  const heightIn = numInput(m.heightIn, (v) => { m.heightIn = v; renderMaterials(); });
  const coats = el("input", { type: "number", value: m.coats, min: 1, max: 4 }); coats.addEventListener("change", () => { m.coats = Math.max(1, Math.min(4, num(coats.value, 2))); renderMaterials(); });
  const ceil = el("input", { type: "checkbox", checked: m.ceiling }); ceil.addEventListener("change", () => { m.ceiling = ceil.checked; renderMaterials(); });
  const ppg = el("input", { type: "number", value: m.pricePerGallon ?? "", min: 0, step: "0.01", placeholder: "optional" }); ppg.addEventListener("change", () => { m.pricePerGallon = ppg.value === "" ? undefined : num(ppg.value, 0); renderMaterials(); });
  const ppsf = el("input", { type: "number", value: m.pricePerSqFt ?? "", min: 0, step: "0.01", placeholder: "optional" }); ppsf.addEventListener("change", () => { m.pricePerSqFt = ppsf.value === "" ? undefined : num(ppsf.value, 0); renderMaterials(); });
  const matPanel = el("div", { class: "panel" }, el("h2", { text: "Materials" }),
    el("div", { class: "row" }, field("Ceiling height", heightIn), field("Paint coats", coats)),
    el("div", { class: "row" }, field("Price per gallon", ppg), field("Flooring price per sq ft", ppsf)),
    el("label", { class: "help" }, ceil, " Paint the ceiling too"), el("div", { id: "materials" }));
  side.replaceChildren(roomPanel, openPanel, furniturePanel, matPanel);
  renderMaterials();
}

function renderMaterials() {
  const host = document.getElementById("materials");
  if (!host) return;
  try {
    const r = estimateMaterials({ room: state.room, wallHeight: state.mat.heightIn, paint: { coats: state.mat.coats, ceiling: state.mat.ceiling, pricePerGallon: state.mat.pricePerGallon }, flooring: { pricePerSqFt: state.mat.pricePerSqFt } });
    const rows: [string, string][] = [
      ["Floor", `${r.floorAreaSqFt} sq ft (buy ${r.flooringSqFtWithWaste} with waste)`],
      ["Walls", `${r.wallAreaSqFt} sq ft`],
      ["Paint", `${r.paintGallons} gal needed, buy ${r.paintGallonsToBuy}`],
      ["Baseboard", `${r.baseboardFeet} ft (buy ${r.baseboardFeetWithWaste})`],
      ...(r.costs.total !== undefined ? [["Cost", r.costs.total.toFixed(2)] as [string, string]] : []),
    ];
    host.replaceChildren(el("dl", { class: "kv" }, ...rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])), el("p", { class: "help", text: r.assumptions[r.assumptions.length - 1]! }));
  } catch (e) {
    host.replaceChildren(el("p", { class: "help", text: e instanceof Error ? e.message : String(e) }));
  }
}

// ---------------------------------------------------------------------------------------------
// Main panel: toolbar, plan canvas, checks
// ---------------------------------------------------------------------------------------------
// The main panel's frame is built once. Only its contents are updated afterwards: replacing a button while the
// user is clicking it (for example when typing in a field and clicking away fires a change event) would lose the click.
const ui = {} as {
  banner: HTMLElement; toolbar: HTMLElement; status: HTMLElement; canvas: HTMLElement; checks: HTMLElement;
  plan: HTMLButtonElement; rotate: HTMLButtonElement; save: HTMLButtonElement; copyEdit: HTMLButtonElement; copyShare: HTMLButtonElement;
  svg: HTMLButtonElement; print: HTMLButtonElement; del: HTMLButtonElement;
};
const statusEl = () => ui.status;

function buildMain() {
  const mk = (label: string, fn: () => void, cls = "") => { const b = el("button", { type: "button", text: label, class: cls }); b.onclick = fn; return b; };
  ui.plan = mk("Plan layout", planLayout);
  ui.rotate = mk("Rotate selected", () => rotateSelected(), "secondary");
  ui.save = mk("Save and get link", () => void save());
  ui.copyEdit = mk("Copy edit link", () => void copyLink(true), "secondary");
  ui.copyShare = mk("Copy share link", () => void copyLink(false), "secondary");
  ui.svg = mk("Download SVG", downloadSvg, "secondary");
  ui.print = mk("Print", () => window.print(), "secondary");
  ui.del = mk("Delete plan", () => void remove(), "danger");
  ui.toolbar = el("div", { class: "toolbar" }, ui.plan, ui.rotate, ui.save, ui.copyEdit, ui.copyShare, ui.svg, ui.print, ui.del);
  ui.banner = el("div", { id: "banner" });
  ui.status = el("p", { id: "status", class: "status", role: "status", "aria-live": "polite" });
  ui.canvas = el("div", { class: "canvas", id: "canvas" });
  ui.checks = el("div", { class: "panel" });
  main.replaceChildren(ui.banner, ui.toolbar, ui.status, ui.canvas, ui.checks);
}

function updateToolbar() {
  const none = state.placements.length === 0;
  ui.plan.disabled = state.readOnly;
  ui.rotate.disabled = state.readOnly || !state.selected;
  ui.save.disabled = state.readOnly || none;
  ui.save.textContent = state.id ? "Save changes" : "Save and get link";
  ui.copyEdit.disabled = !state.id || !state.token;
  ui.copyShare.disabled = !state.id;
  ui.svg.disabled = none;
  ui.print.disabled = none;
  ui.del.disabled = !state.id || !state.token;
}

function renderBanner() {
  ui.banner.replaceChildren();
  if (!state.readOnly) return;
  const copy = el("button", { type: "button", text: "Make my own editable copy" });
  copy.onclick = () => void makeCopy();
  ui.banner.append(el("div", { class: "banner" }, "You are viewing a shared plan, so it cannot be changed. ", copy));
}

function renderCanvas() {
  ui.canvas.replaceChildren();
  if (state.placements.length) {
    const bad = (state.report?.results ?? []).filter((r) => !r.ok).flatMap((r) => state.pieces.filter((p) => r.detail.includes(p.name)).map((p) => p.id));
    // layoutToSvg escapes every string it draws, so its output is safe to insert as markup.
    ui.canvas.innerHTML = layoutToSvg(state.room, state.pieces, state.placements, { report: state.report, highlight: bad });
    if (state.selected) ui.canvas.querySelector(`g.rp-piece[data-id="${state.selected}"]`)?.classList.add("rp-sel");
  } else {
    ui.canvas.append(el("p", { class: "help", text: "Describe your room and furniture on the left, then press “Plan layout”." }));
  }
}

function renderChecks() {
  ui.checks.replaceChildren(
    el("h2", { text: state.report ? `${state.report.passed} of ${state.report.total} checks passed` : "Checks" }),
    state.report ? el("ul", { class: "rchecks" }, ...state.report.results.map((r) => el("li", { class: r.ok ? "ok" : "no", text: `${r.description}: ${r.detail}` }))) : el("p", { class: "help", text: "Checks appear after the layout is planned." }),
    el("p", { class: "help", text: "Rules of thumb for comfort and access, not building-code or structural advice." }),
  );
}

function renderMain() {
  renderBanner();
  updateToolbar();
  renderCanvas();
  renderChecks();
}

// ---------------------------------------------------------------------------------------------
// Dragging, rotating, nudging
// ---------------------------------------------------------------------------------------------
const pieceOf = (id: string) => state.pieces.find((p) => p.id === id)!;
const placementOf = (id: string) => state.placements.find((p) => p.id === id)!;
const snap = (v: number) => Math.round(v);

function commitMove(id: string, x: number, y: number) {
  const piece = pieceOf(id), pl = placementOf(id);
  const b = footprint(piece, { ...pl, x, y });
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  let nx = Math.min(Math.max(0, snap(x)), state.room.width - w), ny = Math.min(Math.max(0, snap(y)), state.room.length - h);
  if (nx <= 3) nx = 0;
  if (state.room.width - (nx + w) <= 3) nx = state.room.width - w;
  if (ny <= 3) ny = 0;
  if (state.room.length - (ny + h) <= 3) ny = state.room.length - h;
  pl.x = nx; pl.y = ny;
  state.dirty = true;
  verify();
  renderMain();
}

function rotateSelected() {
  const id = state.selected;
  if (!id || state.readOnly) return;
  const piece = pieceOf(id), pl = placementOf(id);
  const b = footprint(piece, pl);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const rot = ((pl.rot + 90) % 360) as Rot;
  const nb = footprint(piece, { ...pl, rot });
  pl.rot = rot;
  commitMove(id, cx - (nb.x1 - nb.x0) / 2, cy - (nb.y1 - nb.y0) / 2);
}

function attachCanvas() {
  const canvas = main;
  canvas.addEventListener("pointerdown", (ev) => {
    const target = (ev.target as Element).closest?.("g.rp-piece") as SVGGElement | null;
    const svg = canvas.querySelector("svg.rp-plan") as SVGSVGElement | null;
    if (!target || !svg) {
      // Deselect only for clicks on the canvas itself, and without re-rendering: rebuilding the toolbar here
      // would destroy a button in the middle of the user's click.
      if (state.selected && (ev.target as Element).closest?.(".canvas")) {
        state.selected = undefined;
        canvas.querySelectorAll(".rp-sel").forEach((n) => n.classList.remove("rp-sel"));
        updateToolbar();
      }
      return;
    }
    const id = target.dataset.id!;
    if (state.selected !== id) { state.selected = id; target.parentElement!.querySelectorAll(".rp-sel").forEach((n) => n.classList.remove("rp-sel")); target.classList.add("rp-sel"); updateToolbar(); }
    if (state.readOnly) return;
    const toUnits = (e: PointerEvent) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM()!.inverse()); };
    const start = toUnits(ev), pl = placementOf(id), x0 = pl.x, y0 = pl.y;
    target.setPointerCapture(ev.pointerId);
    target.classList.add("dragging");
    let moved = false;
    const move = (e: PointerEvent) => {
      const p = toUnits(e);
      const dx = (p.x - start.x) / PLAN_SCALE, dy = (p.y - start.y) / PLAN_SCALE;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) moved = true;
      target.setAttribute("transform", `translate(${dx * PLAN_SCALE} ${dy * PLAN_SCALE})`);
      (target as unknown as { _d: [number, number] })._d = [dx, dy];
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      const d = (target as unknown as { _d?: [number, number] })._d ?? [0, 0];
      if (moved) commitMove(id, x0 + d[0], y0 + d[1]); else target.classList.remove("dragging");
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
  document.addEventListener("keydown", (e) => {
    if (!state.selected || state.readOnly) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const step = e.shiftKey ? 6 : 1, pl = placementOf(state.selected);
    if (e.key === "r" || e.key === "R") { e.preventDefault(); rotateSelected(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); commitMove(state.selected, pl.x - step, pl.y); }
    else if (e.key === "ArrowRight") { e.preventDefault(); commitMove(state.selected, pl.x + step, pl.y); }
    else if (e.key === "ArrowUp") { e.preventDefault(); commitMove(state.selected, pl.x, pl.y - step); }
    else if (e.key === "ArrowDown") { e.preventDefault(); commitMove(state.selected, pl.x, pl.y + step); }
  });
}

// ---------------------------------------------------------------------------------------------
// Save, share, delete, export
// ---------------------------------------------------------------------------------------------
function toPlan(): RoomPlan {
  return { v: 1, unit: state.unit, room: state.room, pieces: state.pieces, placements: state.placements, report: state.report!, status: state.status === "solved" ? "solved" : "partial", unplaced: state.unplaced };
}
function fromPlan(p: RoomPlan) {
  state.unit = p.unit; state.room = p.room; state.pieces = p.pieces; state.placements = p.placements; state.report = p.report; state.status = p.status; state.unplaced = p.unplaced;
  state.nextId = 1 + Math.max(0, ...p.pieces.map((x) => Number(x.id.replace(/\D/g, "")) || 0), ...p.room.openings.map((o) => Number(o.id.replace(/\D/g, "")) || 0));
}
const links = () => ({ view: `${location.origin}/p/${state.id}`, edit: `${location.origin}/p/${state.id}#k=${state.token}` });

async function save() {
  verify();
  setStatus(statusEl(), "Saving…");
  try {
    if (state.id && state.token) await planApi.save(state.id, state.token, toPlan());
    else {
      const { id, manageToken } = await planApi.create("room", toPlan());
      state.id = id; state.token = manageToken;
      history.replaceState(null, "", `/p/${id}#k=${manageToken}`);
    }
    state.dirty = false;
    renderMain();
    setStatus(statusEl(), "Saved. Anyone with the share link can view this plan; only the edit link can change it. Plans are deleted 90 days after the last edit.", "ok");
  } catch (e) {
    setStatus(statusEl(), e instanceof Error ? e.message : "Could not save", "err");
  }
}
async function makeCopy() {
  try {
    const { id, manageToken } = await planApi.create("room", toPlan());
    location.href = `/p/${id}#k=${manageToken}`;
  } catch (e) { setStatus(statusEl(), e instanceof Error ? e.message : "Could not copy", "err"); }
}
async function copyLink(edit: boolean) {
  const l = links();
  const ok = await copyText(edit ? l.edit : l.view);
  setStatus(statusEl(), ok ? (edit ? "Edit link copied. Keep it private: anyone with it can change or delete the plan." : "Share link copied.") : "Could not copy automatically. Copy the address from your browser.", ok ? "ok" : "err");
}
async function remove() {
  if (!state.id || !state.token || !confirm("Delete this plan permanently?")) return;
  try {
    await planApi.remove(state.id, state.token);
    location.href = "/app/";
  } catch (e) { setStatus(statusEl(), e instanceof Error ? e.message : "Could not delete", "err"); }
}
function downloadSvg() {
  const svg = main.querySelector("svg.rp-plan");
  if (!svg) return;
  const xml = svg.outerHTML.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/(<svg [^>]*>)/, `$1<style>${PLAN_CSS}</style>`);
  downloadFile("room-plan.svg", "image/svg+xml", xml);
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------
window.addEventListener("beforeunload", (e) => { if (state.dirty && !state.readOnly) { e.preventDefault(); } });

async function boot() {
  buildMain();
  attachCanvas();
  const loc = parseLocation();
  if (loc.id) {
    try {
      const plan = await planApi.load<RoomPlan>(loc.id);
      if (plan.kind !== "room") throw new Error("This link is for a different kind of plan.");
      fromPlan(plan.data);
      state.id = loc.id; state.token = loc.token; state.readOnly = !loc.token;
      verify();
      renderSide(); renderMain();
      setStatus(statusEl(), state.readOnly ? "" : "Editing a saved plan. Drag pieces; the checks update as you move them.");
      return;
    } catch (e) {
      main.replaceChildren(el("div", { class: "banner", text: e instanceof Error ? e.message : "Could not open this plan." }), el("p", {}, el("a", { href: "/app/", text: "Start a new plan" })));
      side.replaceChildren();
      return;
    }
  }
  const presets = ["Sofa", "Coffee table", "Armchair", "TV unit"];
  for (const n of presets) { const f = FURNITURE_PRESETS.find((x) => x.name === n)!; addPiece(f.name, f.kind, f.w, f.d, f.tall); }
  renderSide(); renderMain();
  planLayout();
  state.dirty = false; // the automatic first plan is not an edit, so leaving the page needs no warning
}
void boot();

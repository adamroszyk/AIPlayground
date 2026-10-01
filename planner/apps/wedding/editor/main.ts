import { copyText, downloadFile, el, field, num, parseLocation, planApi, setStatus } from "@planner/editor-kit";
import {
  SEATING_CSS, buildTimeline, seatingGroups, seatingToSvg, solveSeating, verifySeating,
  type Guest, type Rule, type SeatingReport, type Table, type Timeline, type TimelineInput,
} from "@planner/engine";
import { buildGuests, buildRules, buildTables, type RuleInput, type SeatingPlan } from "../src/model.ts";

interface TableRow { name: string; seats: number; head: boolean }
interface State {
  guestsText: string;
  rulesText: string;
  tables: TableRow[];
  tl: TimelineInput;
  tlOn: boolean;
  guests: Guest[];
  tableList: Table[];
  rules: Rule[];
  seats: Record<string, string[]>;
  report?: SeatingReport;
  status: "draft" | "solved" | "infeasible";
  conflicts: string[];
  relaxed: string[];
  timeline?: Timeline;
  selected?: string;
  id?: string;
  token?: string;
  dirty: boolean;
  readOnly: boolean;
}

const SAMPLE_GUESTS = `Maya, Couple
Daniel, Couple
Priya Rao, Maya's family, Rao
Arjun Rao, Maya's family, Rao
Neha, Maya's family
Tom Whitfield, Daniel's family, Whitfield
Helen Whitfield, Daniel's family, Whitfield
Sam, Daniel's family
Jo, College friends
Alex, College friends
Kim, College friends
Lee, College friends
Rosa, Work
Ben, Work
Cara, Work
Dev, Work`;
const SAMPLE_RULES = `head: Maya, Daniel, Priya Rao, Arjun Rao, Tom Whitfield, Helen Whitfield
together group: College friends
apart: Alex, Sam
fixed: Neha @ Table 1`;

const state: State = {
  guestsText: SAMPLE_GUESTS,
  rulesText: SAMPLE_RULES,
  tables: [{ name: "Head table", seats: 6, head: true }, { name: "Table 1", seats: 6, head: false }, { name: "Table 2", seats: 6, head: false }],
  tl: { ceremonyStart: "16:00", ceremonyMinutes: 30, photosMinutes: 45, travelMinutes: 0, bufferMinutes: 10, venueCurfew: "23:00" },
  tlOn: false,
  guests: [], tableList: [], rules: [], seats: {},
  status: "draft", conflicts: [], relaxed: [],
  dirty: false, readOnly: false,
};

const root = document.getElementById("app")!;
const side = el("aside", { id: "side" });
const main = el("section", { id: "main" });
root.replaceChildren(side, main);

// ---------------------------------------------------------------------------------------------
// Text formats: one guest per line, one rule per line
// ---------------------------------------------------------------------------------------------
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function parseGuests(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name = "", group, party] = l.split(",").map((x) => x.trim());
    return { name, ...(group ? { group } : {}), ...(party ? { party } : {}) };
  });
}
function parseRules(text: string): RuleInput[] {
  const out: RuleInput[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const bad = (m: string): never => { throw new RangeError(`Rule line ${i + 1}: ${m}`); };
    const m = /^(together|apart|head|fixed)(\s+group)?\s*:\s*(.+)$/i.exec(line);
    if (!m) return bad(`start with together:, together group:, apart:, head: or fixed:. Got “${line.slice(0, 40)}”.`);
    const kind = m[1]!.toLowerCase(), rest = m[3]!;
    if (kind === "together") out.push(m[2] ? { type: "together", group: rest.trim() } : { type: "together", guests: list(rest) });
    else if (kind === "apart") { const n = list(rest); if (n.length !== 2) bad("apart: needs exactly two names, like apart: Alex, Jo"); out.push({ type: "apart", a: n[0]!, b: n[1]! }); }
    else if (kind === "head") out.push({ type: "head_table", guests: list(rest) });
    else { const [g, t] = rest.split("@").map((x) => x.trim()); if (!g || !t) bad("fixed: needs a name and a table, like fixed: Neha @ Table 1"); out.push({ type: "fixed", guest: g!, table: t! }); }
  });
  return out;
}
function ruleLine(r: Rule, guests: Guest[], tables: Table[]): string {
  const g = (id: string) => guests.find((x) => x.id === id)?.name ?? id;
  switch (r.type) {
    case "together": return r.guests ? `together: ${r.guests.map(g).join(", ")}` : `together group: ${r.group ?? r.party ?? ""}`;
    case "apart": return `apart: ${g(r.a)}, ${g(r.b)}`;
    case "head_table": return `head: ${r.guests.map(g).join(", ")}`;
    case "fixed": return `fixed: ${g(r.guest)} @ ${tables.find((t) => t.id === r.table)?.name ?? r.table}`;
  }
}
const guestLine = (g: Guest) => [g.name, g.group ?? "", g.party ?? ""].join(", ").replace(/(, )+$/, "");

/** Turns the form into engine inputs. Throws RangeError with a user-readable message. */
function compile() {
  const guests = buildGuests(parseGuests(state.guestsText));
  const tableList = buildTables(state.tables.map((t) => ({ name: t.name.trim() || undefined, seats: t.seats, head: t.head })));
  const rules = buildRules(parseRules(state.rulesText), guests, tableList);
  const seatsTotal = tableList.reduce((n, t) => n + t.capacity, 0);
  if (seatsTotal < guests.length) throw new RangeError(`${guests.length} guests but only ${seatsTotal} seats. Add a table or make tables bigger.`);
  return { guests, tableList, rules };
}

// ---------------------------------------------------------------------------------------------
// Solving and verification
// ---------------------------------------------------------------------------------------------
const assignmentOf = () => Object.fromEntries(Object.entries(state.seats).flatMap(([t, ids]) => ids.map((g) => [g, t] as const)));
function verify() {
  state.report = verifySeating({ guests: state.guests, tables: state.tableList, rules: state.rules }, assignmentOf());
  state.status = state.report.ok ? "solved" : "infeasible";
}
const hasChart = () => state.tableList.length > 0 && Object.keys(state.seats).length > 0;

function plan() {
  try {
    const c = compile();
    const res = solveSeating({ guests: c.guests, tables: c.tableList, rules: c.rules }, { seed: 1 });
    state.guests = c.guests; state.tableList = c.tableList; state.rules = c.rules;
    state.seats = res.seats; state.report = res.report; state.status = res.status; state.conflicts = res.conflicts; state.relaxed = res.relaxedRules;
    state.selected = undefined; state.dirty = true;
    renderMain();
    setStatus(ui.status, res.status === "solved" ? "Chart ready, and every rule is met. Drag guests to other seats; the rules are re-checked as you go." : "These rules cannot all be met together. This is the closest chart; the conflicts are listed below.", res.status === "solved" ? "ok" : "");
  } catch (e) {
    setStatus(ui.status, e instanceof Error ? e.message : String(e), "err");
  }
}
/** Editing the guest list, tables or rules invalidates the chart until it is planned again. */
function structural() {
  state.seats = {}; state.report = undefined; state.status = "draft"; state.conflicts = []; state.relaxed = []; state.guests = []; state.tableList = []; state.rules = [];
  state.selected = undefined; state.dirty = true;
  renderMain();
  setStatus(ui.status, "The guests, tables or rules changed. Press “Plan seating” to build the chart again.", "");
}

// ---------------------------------------------------------------------------------------------
// Moving guests
// ---------------------------------------------------------------------------------------------
const nameOf = (id: string) => state.guests.find((g) => g.id === id)?.name ?? id;
const tableName = (id: string) => state.tableList.find((t) => t.id === id)?.name ?? id;

function moveGuest(gid: string, toTable: string, toIdx?: number) {
  const from = Object.keys(state.seats).find((t) => state.seats[t]!.includes(gid));
  if (!from) return;
  const src = state.seats[from]!, dst = state.seats[toTable]!, cap = state.tableList.find((t) => t.id === toTable)!.capacity;
  const occupant = toIdx !== undefined ? dst[toIdx] : undefined;
  if (occupant && occupant !== gid) {
    const i = src.indexOf(gid), j = toIdx!;
    if (from === toTable) { [src[i], src[j]] = [src[j]!, src[i]!]; } else { src[i] = occupant; dst[j] = gid; }
    setStatus(ui.status, `${nameOf(gid)} and ${nameOf(occupant)} swapped seats.`, "");
  } else if (from === toTable) {
    return;
  } else if (dst.length >= cap) {
    setStatus(ui.status, `${tableName(toTable)} is full. Drop onto a guest there to swap seats instead.`, "err");
    return;
  } else {
    src.splice(src.indexOf(gid), 1);
    dst.push(gid);
    setStatus(ui.status, `${nameOf(gid)} moved to ${tableName(toTable)}.`, "");
  }
  state.dirty = true;
  verify();
  renderMain();
}

// ---------------------------------------------------------------------------------------------
// Side panel: guests, tables, rules, timeline
// ---------------------------------------------------------------------------------------------
function renderSide() {
  const dis = state.readOnly;
  const guests = el("textarea", { rows: 10, spellcheck: false, maxLength: 20000, "aria-label": "Guest list" });
  guests.value = state.guestsText; guests.disabled = dis;
  guests.addEventListener("change", () => { state.guestsText = guests.value; structural(); });
  const guestsPanel = el("div", { class: "panel" }, el("h2", { text: "Guests" }), guests,
    el("p", { class: "help", text: "One guest per line: name, group, party. Guests with the same party (a couple, a family) always share a table; a group is kept together where possible. First names are enough, but each name must be unique." }));

  const rows = state.tables.map((t, i) => {
    const name = el("input", { type: "text", value: t.name, maxLength: 40 }); name.disabled = dis;
    name.addEventListener("change", () => { t.name = name.value; structural(); });
    const seats = el("input", { type: "number", value: t.seats, min: 1, max: 24 }); seats.disabled = dis;
    seats.addEventListener("change", () => { t.seats = Math.max(1, Math.min(24, Math.round(num(seats.value, t.seats)))); structural(); });
    const head = el("input", { type: "checkbox", checked: t.head }); head.disabled = dis;
    head.addEventListener("change", () => { t.head = head.checked; structural(); });
    const rm = el("button", { class: "secondary", type: "button", text: "Remove", disabled: dis });
    rm.onclick = () => { state.tables.splice(i, 1); renderSide(); structural(); };
    return el("div", { class: "row" }, field("Name", name), field("Seats", seats), el("label", { class: "help" }, head, " Head table"), rm);
  });
  const add = el("button", { class: "secondary", type: "button", text: "Add table", disabled: dis });
  add.onclick = () => { const n = state.tables.filter((t) => !t.head).length + 1; state.tables.push({ name: `Table ${n}`, seats: state.tables.find((t) => !t.head)?.seats ?? 8, head: false }); renderSide(); structural(); };
  const seatTotal = state.tables.reduce((n, t) => n + t.seats, 0), guestTotal = parseGuests(state.guestsText).length;
  const tablesPanel = el("div", { class: "panel" }, el("h2", { text: "Tables" }), ...rows, add,
    el("p", { class: "help", text: `${guestTotal} guests, ${seatTotal} seats.` }));

  const rules = el("textarea", { rows: 6, spellcheck: false, maxLength: 8000, "aria-label": "Seating rules" });
  rules.value = state.rulesText; rules.disabled = dis;
  rules.addEventListener("change", () => { state.rulesText = rules.value; structural(); });
  const rulesPanel = el("div", { class: "panel" }, el("h2", { text: "Rules" }), rules,
    el("p", { class: "help", text: "One rule per line:" }),
    el("ul", { class: "help rulehelp" }, el("li", { text: "together: Ann, Bob, Cy" }), el("li", { text: "together group: College friends" }), el("li", { text: "apart: Alex, Jo" }), el("li", { text: "head: Maya, Daniel" }), el("li", { text: "fixed: Neha @ Table 1" })));

  side.replaceChildren(guestsPanel, tablesPanel, rulesPanel, timelinePanel());
}

const TL_FIELDS: [keyof TimelineInput, string, "time" | "min"][] = [
  ["ceremonyStart", "Ceremony starts", "time"], ["ceremonyMinutes", "Ceremony (min)", "min"], ["photosMinutes", "Photos (min)", "min"], ["travelMinutes", "Travel between venues (min)", "min"],
  ["cocktailMinutes", "Cocktail hour (min)", "min"], ["dinnerMinutes", "Dinner (min)", "min"], ["toastsMinutes", "Toasts (min)", "min"], ["danceMinutes", "Dancing (min)", "min"],
  ["bufferMinutes", "Buffer between segments (min)", "min"], ["venueCurfew", "Venue must be empty by", "time"], ["sunset", "Sunset (for outdoor photos)", "time"],
];
function timelinePanel(): HTMLElement {
  const inputs = TL_FIELDS.map(([k, label, type]) => {
    const i = el("input", { type: type === "time" ? "time" : "number", min: type === "min" ? 0 : undefined, max: type === "min" ? 360 : undefined, value: String(state.tl[k] ?? ""), placeholder: type === "min" ? "default" : undefined });
    i.disabled = state.readOnly;
    i.addEventListener("change", () => {
      const t = state.tl as unknown as Record<string, string | number | undefined>;
      t[k] = i.value === "" ? undefined : type === "time" ? i.value : Math.max(0, Math.min(360, num(i.value, 0)));
      if (k === "ceremonyStart" && !t[k]) t[k] = "16:00";
      if (state.tlOn) buildDay();
    });
    return field(label, i);
  });
  const go = el("button", { type: "button", text: state.tlOn ? "Update timeline" : "Build day-of timeline", disabled: state.readOnly });
  go.onclick = () => buildDay();
  return el("div", { class: "panel" }, el("h2", { text: "Day-of timeline" }), el("div", { class: "row" }, ...inputs.slice(0, 2)), ...inputs.slice(2).reduce<HTMLElement[]>((rows, f, i) => { if (i % 2 === 0) rows.push(el("div", { class: "row" })); rows[rows.length - 1]!.append(f); return rows; }, []), go);
}
function buildDay() {
  try {
    state.timeline = buildTimeline(state.tl);
    state.tlOn = true; state.dirty = true;
    renderMain();
    setStatus(ui.status, "Timeline built.", "ok");
  } catch (e) {
    setStatus(ui.status, e instanceof Error ? e.message : String(e), "err");
  }
}

// ---------------------------------------------------------------------------------------------
// Main panel (frame built once; only contents change, so a click is never lost to a re-render)
// ---------------------------------------------------------------------------------------------
const ui = {} as {
  banner: HTMLElement; status: HTMLElement; legend: HTMLElement; canvas: HTMLElement; checks: HTMLElement; conflicts: HTMLElement; timeline: HTMLElement;
  plan: HTMLButtonElement; save: HTMLButtonElement; copyEdit: HTMLButtonElement; copyShare: HTMLButtonElement; csv: HTMLButtonElement; print: HTMLButtonElement; del: HTMLButtonElement;
};
function buildMain() {
  const mk = (label: string, fn: () => void, cls = "") => { const b = el("button", { type: "button", text: label, class: cls }); b.onclick = fn; return b; };
  ui.plan = mk("Plan seating", plan);
  ui.save = mk("Save and get link", () => void save());
  ui.copyEdit = mk("Copy edit link", () => void copyLink(true), "secondary");
  ui.copyShare = mk("Copy share link", () => void copyLink(false), "secondary");
  ui.csv = mk("Download CSV", downloadCsv, "secondary");
  ui.print = mk("Print", () => window.print(), "secondary");
  ui.del = mk("Delete plan", () => void remove(), "danger");
  ui.banner = el("div", { id: "banner" });
  ui.status = el("p", { id: "status", class: "status", role: "status", "aria-live": "polite" });
  ui.legend = el("div", { class: "rp-legend" });
  ui.canvas = el("div", { class: "canvas", id: "canvas" });
  ui.checks = el("div", { class: "panel" });
  ui.conflicts = el("div", { id: "conflicts" });
  ui.timeline = el("div", { id: "timeline" });
  main.replaceChildren(ui.banner, el("div", { class: "toolbar" }, ui.plan, ui.save, ui.copyEdit, ui.copyShare, ui.csv, ui.print, ui.del), ui.status, ui.legend, ui.canvas, ui.conflicts, ui.checks, ui.timeline);
}

function renderMain() {
  // toolbar
  const none = !hasChart();
  ui.plan.disabled = state.readOnly;
  ui.save.disabled = state.readOnly || none;
  ui.save.textContent = state.id ? "Save changes" : "Save and get link";
  ui.copyEdit.disabled = !state.id || !state.token;
  ui.copyShare.disabled = !state.id;
  ui.csv.disabled = none; ui.print.disabled = none;
  ui.del.disabled = !state.id || !state.token;
  // banner
  ui.banner.replaceChildren();
  if (state.readOnly) {
    const copy = el("button", { type: "button", text: "Make my own editable copy" });
    copy.onclick = () => void makeCopy();
    ui.banner.append(el("div", { class: "banner" }, "You are viewing a shared plan, so it cannot be changed. ", copy));
  }
  // chart
  ui.canvas.replaceChildren(); ui.legend.replaceChildren();
  if (hasChart()) {
    const bad = (state.report?.results ?? []).filter((r) => !r.ok).flatMap((r) => state.guests.filter((g) => r.detail.includes(g.name) || r.description.includes(g.name)).map((g) => g.id));
    // seatingToSvg escapes every string it draws, so its output is safe to insert as markup.
    ui.canvas.innerHTML = seatingToSvg(state.tableList, state.guests, state.seats, { report: state.report, highlight: bad });
    if (state.selected) ui.canvas.querySelector(`g.rp-seatg[data-guest="${state.selected}"]`)?.classList.add("rp-sel");
    for (const g of seatingGroups(state.guests)) ui.legend.append(el("span", {}, el("i", { class: g.cls }), g.group));
  } else {
    ui.canvas.append(el("p", { class: "help", text: "Add your guests, tables and rules on the left, then press “Plan seating”." }));
  }
  // checks
  ui.checks.replaceChildren(
    el("h2", { text: state.report ? `${state.report.passed} of ${state.report.total} checks passed` : "Checks" }),
    state.report ? el("ul", { class: "rchecks" }, ...state.report.results.map((r) => el("li", { class: r.ok ? "ok" : "no", text: `${r.description}: ${r.detail}` }))) : el("p", { class: "help", text: "Checks appear after the chart is planned." }),
  );
  // conflicts
  ui.conflicts.replaceChildren();
  if (state.conflicts.length) {
    ui.conflicts.append(el("div", { class: "panel conflict" }, el("h2", { text: "Why not every rule can be met" }), el("ul", {}, ...state.conflicts.map((c) => el("li", { text: c }))),
      ...(state.relaxed.length ? [el("p", { class: "help", text: `Removing one of these makes the rest work: ${state.relaxed.join("; ")}` })] : [])));
  }
  // timeline
  ui.timeline.replaceChildren();
  if (state.timeline) {
    const t = state.timeline;
    ui.timeline.append(el("div", { class: "panel" }, el("h2", { text: "Day-of timeline" }),
      el("table", { class: "tl" }, el("tbody", {}, ...t.segments.map((s) => el("tr", {}, el("td", { text: `${s.start}${s.day ? " (+1)" : ""}` }), el("td", { text: s.name }), el("td", { text: `${s.minutes} min` }), el("td", { text: s.note ?? "" }))))),
      el("p", { class: "help", text: `Ends at ${t.endTime}. The day runs ${Math.floor(t.totalMinutes / 60)} h ${t.totalMinutes % 60} min.` }),
      ...(t.warnings.length ? [el("ul", { class: "warn" }, ...t.warnings.map((w) => el("li", { text: w })))] : [])));
  }
}

// ---------------------------------------------------------------------------------------------
// Dragging guests between seats and tables
// ---------------------------------------------------------------------------------------------
function attachCanvas() {
  main.addEventListener("pointerdown", (ev) => {
    const seat = (ev.target as Element).closest?.("g.rp-seatg") as SVGGElement | null;
    const svg = main.querySelector("svg.rp-seating") as SVGSVGElement | null;
    if (!seat || !svg) return;
    const gid = seat.dataset.guest!;
    if (state.selected !== gid) {
      state.selected = gid;
      svg.querySelectorAll(".rp-sel").forEach((n) => n.classList.remove("rp-sel"));
      seat.classList.add("rp-sel");
      const g = state.guests.find((x) => x.id === gid);
      setStatus(ui.status, `${g?.name}${g?.group ? ` (${g.group})` : ""} at ${tableName(seat.dataset.table!)}.${state.readOnly ? "" : " Drag to another seat or table."}`, "");
    }
    if (state.readOnly) return;
    const toUnits = (e: PointerEvent) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM()!.inverse()); };
    const start = toUnits(ev);
    seat.setPointerCapture(ev.pointerId);
    let moved = false, dx = 0, dy = 0;
    const move = (e: PointerEvent) => {
      const p = toUnits(e); dx = p.x - start.x; dy = p.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; seat.classList.add("dragging"); }
      seat.setAttribute("transform", `translate(${dx} ${dy})`);
    };
    const up = (e: PointerEvent) => {
      seat.removeEventListener("pointermove", move);
      seat.removeEventListener("pointerup", up);
      seat.removeEventListener("pointercancel", up);
      if (!moved) { seat.removeAttribute("transform"); return; }
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under?.closest?.("[data-seat]") as SVGElement | null;
      const table = (target ?? (under?.closest?.("g.rp-table") as SVGElement | null))?.dataset.table;
      seat.classList.remove("dragging"); seat.removeAttribute("transform");
      if (!table || (e.type === "pointercancel")) return;
      moveGuest(gid, table, target?.dataset.seat !== undefined ? Number(target.dataset.seat) : undefined);
    };
    seat.addEventListener("pointermove", move);
    seat.addEventListener("pointerup", up);
    seat.addEventListener("pointercancel", up);
  });
}

// ---------------------------------------------------------------------------------------------
// Save, share, delete, export
// ---------------------------------------------------------------------------------------------
function toPlan(): SeatingPlan {
  const assignment = assignmentOf();
  return { v: 1, guests: state.guests, tables: state.tableList, rules: state.rules, assignment, seats: state.seats, report: state.report!, status: state.status === "solved" ? "solved" : "infeasible", conflicts: state.conflicts, relaxedRules: state.relaxed, ...(state.timeline ? { timeline: state.timeline } : {}), timelineInput: state.tl };
}
function fromPlan(p: SeatingPlan) {
  state.guests = p.guests; state.tableList = p.tables; state.rules = p.rules; state.seats = p.seats; state.conflicts = p.conflicts; state.relaxed = p.relaxedRules;
  state.guestsText = p.guests.map(guestLine).join("\n");
  state.rulesText = p.rules.map((r) => ruleLine(r, p.guests, p.tables)).join("\n");
  state.tables = p.tables.map((t) => ({ name: t.name ?? t.id, seats: t.capacity, head: !!t.head }));
  if (p.timelineInput) state.tl = p.timelineInput;
  if (p.timeline) { state.timeline = p.timeline; state.tlOn = true; }
}
const links = () => ({ view: `${location.origin}/p/${state.id}`, edit: `${location.origin}/p/${state.id}#k=${state.token}` });

async function save() {
  verify();
  setStatus(ui.status, "Saving…");
  try {
    if (state.id && state.token) await planApi.save(state.id, state.token, toPlan());
    else {
      const { id, manageToken } = await planApi.create("seating", toPlan());
      state.id = id; state.token = manageToken;
      history.replaceState(null, "", `/p/${id}#k=${manageToken}`);
    }
    state.dirty = false;
    renderMain();
    setStatus(ui.status, "Saved. Anyone with the share link can view this chart; only the edit link can change it. Charts are deleted 90 days after the last edit.", "ok");
  } catch (e) {
    setStatus(ui.status, e instanceof Error ? e.message : "Could not save", "err");
  }
}
async function makeCopy() {
  try {
    const { id, manageToken } = await planApi.create("seating", toPlan());
    location.href = `/p/${id}#k=${manageToken}`;
  } catch (e) { setStatus(ui.status, e instanceof Error ? e.message : "Could not copy", "err"); }
}
async function copyLink(edit: boolean) {
  const l = links();
  const ok = await copyText(edit ? l.edit : l.view);
  setStatus(ui.status, ok ? (edit ? "Edit link copied. Keep it private: anyone with it can change or delete the chart." : "Share link copied.") : "Could not copy automatically. Copy the address from your browser.", ok ? "ok" : "err");
}
async function remove() {
  if (!state.id || !state.token || !confirm("Delete this seating chart permanently?")) return;
  try {
    await planApi.remove(state.id, state.token);
    location.href = "/app/";
  } catch (e) { setStatus(ui.status, e instanceof Error ? e.message : "Could not delete", "err"); }
}
/** Spreadsheet-safe: a cell that starts with = + - @ would be run as a formula by Excel or Sheets. */
const cell = (v: string) => { const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function downloadCsv() {
  const rows = [["Table", "Seat", "Guest", "Group"]];
  for (const t of state.tableList) (state.seats[t.id] ?? []).forEach((id, i) => { const g = state.guests.find((x) => x.id === id); rows.push([t.name ?? t.id, String(i + 1), g?.name ?? id, g?.group ?? ""]); });
  downloadFile("seating-chart.csv", "text/csv", rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n");
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------
window.addEventListener("beforeunload", (e) => { if (state.dirty && !state.readOnly) e.preventDefault(); });

async function boot() {
  buildMain();
  attachCanvas();
  const loc = parseLocation();
  if (loc.id) {
    try {
      const loaded = await planApi.load<SeatingPlan>(loc.id);
      if (loaded.kind !== "seating") throw new Error("This link is for a different kind of plan.");
      fromPlan(loaded.data);
      state.id = loc.id; state.token = loc.token; state.readOnly = !loc.token;
      verify();
      renderSide(); renderMain();
      setStatus(ui.status, state.readOnly ? "" : "Editing a saved chart. Drag guests between seats; the rules are re-checked as you go.");
      return;
    } catch (e) {
      main.replaceChildren(el("div", { class: "banner", text: e instanceof Error ? e.message : "Could not open this plan." }), el("p", {}, el("a", { href: "/app/", text: "Start a new chart" })));
      side.replaceChildren();
      return;
    }
  }
  renderSide(); renderMain();
  plan();
  state.dirty = false; // the automatic first chart is not an edit
}
void boot();

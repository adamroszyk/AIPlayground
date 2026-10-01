import type { Guest, Rule, SeatingReport, Table, Timeline, TimelineInput } from "@planner/engine";

export interface GuestInput { name: string; group?: string; party?: string }
export interface TableInput { name?: string; seats: number; count?: number; head?: boolean }
export type RuleInput =
  | { type: "together"; guests?: string[]; group?: string }
  | { type: "apart"; a: string; b: string }
  | { type: "head_table"; guests: string[] }
  | { type: "fixed"; guest: string; table: string };

/** Stored with a plan and drawn by the widget and the web editor. */
export interface SeatingPlan {
  v: 1;
  guests: Guest[];
  tables: Table[];
  rules: Rule[];
  assignment: Record<string, string>;
  seats: Record<string, string[]>;
  report: SeatingReport;
  status: "solved" | "infeasible";
  conflicts: string[];
  relaxedRules: string[];
  timeline?: Timeline;
  /** What the web editor needs to reopen the timeline form. */
  timelineInput?: TimelineInput;
}

const err = (m: string): never => { throw new RangeError(m); };
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function buildGuests(list: GuestInput[]): Guest[] {
  if (list.length === 0) err("Add at least one guest.");
  if (list.length > 300) err("Up to 300 guests at a time.");
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  const guests = list.map((g, i) => {
    const name = g.name.trim();
    if (!name) err(`Guest ${i + 1} has no name.`);
    if (seen.has(key(name))) dupes.push(name);
    seen.set(key(name), name);
    return { id: `g${i + 1}`, name, ...(g.group?.trim() ? { group: g.group.trim() } : {}), ...(g.party?.trim() ? { party: g.party.trim() } : {}) };
  });
  if (dupes.length) err(`Two guests share the name ${[...new Set(dupes)].map((d) => `"${d}"`).join(", ")}. Add a last initial or a number so each name is unique.`);
  return guests;
}

export function buildTables(list: TableInput[]): Table[] {
  if (list.length === 0) err("Add at least one table.");
  const tables: Table[] = [];
  for (const t of list) {
    const count = t.count ?? 1;
    if (!Number.isInteger(t.seats) || t.seats < 1 || t.seats > 24) err("A table must seat between 1 and 24 guests.");
    if (!Number.isInteger(count) || count < 1 || count > 40) err("Table counts must be between 1 and 40.");
    for (let i = 0; i < count; i++) tables.push({ id: "", capacity: t.seats, ...(t.head ? { head: true } : {}), name: t.name ?? "" });
  }
  if (tables.length > 40) err("Up to 40 tables at a time.");
  let regular = 0, head = 0;
  const headCount = tables.filter((t) => t.head).length;
  for (const t of tables) {
    if (t.head) { head++; t.name = t.name || (headCount > 1 ? `Head table ${head}` : "Head table"); }
    else { regular++; t.name = t.name ? (list.some((x) => x.name === t.name && (x.count ?? 1) > 1) ? `${t.name} ${regular}` : t.name) : `Table ${regular}`; }
  }
  tables.forEach((t, i) => (t.id = `t${i + 1}`));
  const names = new Set<string>();
  for (const t of tables) { if (names.has(key(t.name!))) err(`Two tables are named "${t.name}". Give each table a different name.`); names.add(key(t.name!)); }
  return tables;
}

export function buildRules(list: RuleInput[], guests: Guest[], tables: Table[]): Rule[] {
  const gid = new Map(guests.map((g) => [key(g.name), g.id]));
  const tid = new Map(tables.map((t) => [key(t.name ?? t.id), t.id]));
  const lookup = (name: string) => gid.get(key(name)) ?? err(`The rules mention "${name}", who is not on the guest list.`);
  const table = (name: string) => tid.get(key(name)) ?? err(`The rules mention a table called "${name}". Tables are: ${tables.map((t) => t.name).join(", ")}.`);
  if (list.length > 100) err("Up to 100 rules at a time.");
  return list.map((r, i): Rule => {
    const id = `r${i + 1}`;
    switch (r.type) {
      case "together":
        if (!r.group && (!r.guests || r.guests.length < 2)) err(`Rule ${i + 1}: "together" needs a group or at least two guest names.`);
        if (r.group && !guests.some((g) => key(g.group ?? "") === key(r.group!))) err(`Rule ${i + 1}: no guest is in the group "${r.group}".`);
        return r.group ? { id, type: "together", group: guests.find((g) => key(g.group ?? "") === key(r.group!))!.group } : { id, type: "together", guests: r.guests!.map(lookup) };
      case "apart":
        return { id, type: "apart", a: lookup(r.a), b: lookup(r.b) };
      case "head_table":
        return { id, type: "head_table", guests: r.guests.map(lookup) };
      case "fixed":
        return { id, type: "fixed", guest: lookup(r.guest), table: table(r.table) };
    }
  });
}

/** Name-based arrangement from a tool call to ids; unknown names and tables are errors, not silently dropped. */
export function buildArrangement(arr: { table: string; guests: string[] }[], guests: Guest[], tables: Table[]): { assignment: Record<string, string>; seats: Record<string, string[]> } {
  const gid = new Map(guests.map((g) => [key(g.name), g.id]));
  const tid = new Map(tables.map((t) => [key(t.name ?? t.id), t.id]));
  const assignment: Record<string, string> = {};
  const seats: Record<string, string[]> = Object.fromEntries(tables.map((t) => [t.id, [] as string[]]));
  for (const row of arr) {
    const t = tid.get(key(row.table)) ?? err(`The arrangement mentions a table called "${row.table}". Tables are: ${tables.map((x) => x.name).join(", ")}.`);
    for (const name of row.guests) {
      const g = gid.get(key(name)) ?? err(`The arrangement mentions "${name}", who is not on the guest list.`);
      if (assignment[g]) err(`${name} appears more than once in the arrangement.`);
      assignment[g] = t;
      seats[t]!.push(g);
    }
  }
  return { assignment, seats };
}

export function validateSeatingPlan(data: unknown): void {
  const p = data as Partial<SeatingPlan> | null;
  if (!p || typeof p !== "object" || p.v !== 1 || !Array.isArray(p.guests) || !Array.isArray(p.tables) || !Array.isArray(p.rules) || !p.assignment || !p.seats) err("This is not a valid seating plan");
  const d = p as SeatingPlan;
  if (d.guests.length > 300 || d.tables.length > 40 || d.rules.length > 100) err("Plan is too large");
  for (const g of d.guests) if (typeof g.id !== "string" || typeof g.name !== "string" || g.name.length > 80) err("Invalid guest");
  for (const t of d.tables) if (typeof t.id !== "string" || !(t.capacity >= 1 && t.capacity <= 24)) err("Invalid table");
}

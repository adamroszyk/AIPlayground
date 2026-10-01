import { rng } from "./rng.ts";

export interface Guest {
  id: string;
  name: string;
  /** Soft preference: guests in a group are kept at as few tables as possible. */
  group?: string;
  /** Hard: guests sharing a party id (plus-ones, kids with parents) always sit together. */
  party?: string;
}
export interface Table {
  id: string;
  name?: string;
  capacity: number;
  head?: boolean;
}
export type Rule =
  | { id?: string; type: "together"; guests?: string[]; group?: string; party?: string }
  | { id?: string; type: "apart"; a: string; b: string }
  | { id?: string; type: "head_table"; guests: string[] }
  | { id?: string; type: "fixed"; guest: string; table: string };

export interface SeatingProblem {
  guests: Guest[];
  tables: Table[];
  rules: Rule[];
}
export type Assignment = Record<string, string>; // guestId -> tableId

export interface RuleResult {
  id: string;
  kind: string;
  description: string;
  ok: boolean;
  detail: string;
}
export interface SeatingReport {
  ok: boolean;
  passed: number;
  total: number;
  results: RuleResult[];
}
export interface SeatingResult {
  status: "solved" | "infeasible";
  assignment: Assignment;
  /** Guest ids per table in seat order (for drawing). */
  seats: Record<string, string[]>;
  report: SeatingReport;
  /** Human-readable reasons when the rules cannot all be met. */
  conflicts: string[];
  /** Rules whose removal made the problem solvable (infeasible case only). */
  relaxedRules: string[];
  stats: { blocks: number; nodes: number; restarts: number; groupSplits: number; exhausted: boolean };
}

const withIds = (rules: Rule[]): (Rule & { id: string })[] => rules.map((r, i) => ({ ...r, id: r.id ?? `r${i + 1}` }));

function describeRule(r: Rule, name: (id: string) => string): string {
  switch (r.type) {
    case "together": {
      const who = r.guests ? r.guests.map(name).join(", ") : r.group ? `group "${r.group}"` : `party "${r.party}"`;
      return `Seat together: ${who}`;
    }
    case "apart":
      return `Keep apart: ${name(r.a)} and ${name(r.b)}`;
    case "head_table":
      return `Head table: ${r.guests.map(name).join(", ")}`;
    case "fixed":
      return `Fixed seat: ${name(r.guest)} at ${r.table}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Verifier: independent of the solver. Re-derives every check from the problem and the assignment.
// ---------------------------------------------------------------------------------------------
export function verifySeating(p: SeatingProblem, a: Assignment): SeatingReport {
  const results: RuleResult[] = [];
  const byId = new Map(p.guests.map((g) => [g.id, g]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const tableIds = new Set(p.tables.map((t) => t.id));
  const push = (id: string, kind: string, description: string, ok: boolean, detail: string) => results.push({ id, kind, description, ok, detail });

  const unseated = p.guests.filter((g) => !a[g.id]).map((g) => g.name);
  const unknownTable = p.guests.filter((g) => a[g.id] && !tableIds.has(a[g.id]!)).map((g) => g.name);
  const unknownGuest = Object.keys(a).filter((id) => !byId.has(id));
  push(
    "everyone-seated",
    "builtin",
    "Everyone is seated exactly once",
    unseated.length === 0 && unknownTable.length === 0 && unknownGuest.length === 0,
    unseated.length ? `Not seated: ${unseated.join(", ")}` : unknownTable.length ? `Unknown table for: ${unknownTable.join(", ")}` : unknownGuest.length ? `Unknown guests in assignment: ${unknownGuest.join(", ")}` : `${p.guests.length} guests seated`,
  );

  const load = new Map<string, number>();
  for (const g of p.guests) if (a[g.id]) load.set(a[g.id]!, (load.get(a[g.id]!) ?? 0) + 1);
  const over = p.tables.filter((t) => (load.get(t.id) ?? 0) > t.capacity);
  push("capacity", "builtin", "No table is over capacity", over.length === 0, over.length ? over.map((t) => `${t.name ?? t.id}: ${load.get(t.id)} of ${t.capacity}`).join("; ") : "All tables within capacity");

  const parties = new Map<string, string[]>();
  for (const g of p.guests) if (g.party) parties.set(g.party, [...(parties.get(g.party) ?? []), g.id]);
  if (parties.size) {
    const split = [...parties.entries()].filter(([, ids]) => new Set(ids.map((i) => a[i])).size > 1).map(([k]) => k);
    push("parties", "builtin", "Plus-ones and kids sit with their party", split.length === 0, split.length ? `Split parties: ${split.join(", ")}` : `${parties.size} parties kept together`);
  }

  const tableOf = (id: string) => a[id];
  for (const r of withIds(p.rules)) {
    const description = describeRule(r, name);
    if (r.type === "together") {
      const ids = r.guests ?? p.guests.filter((g) => (r.group ? g.group === r.group : g.party === r.party)).map((g) => g.id);
      const tables = new Set(ids.map(tableOf));
      push(r.id, r.type, description, ids.length > 0 && tables.size === 1 && !tables.has(undefined as never), tables.size === 1 ? `All at ${[...tables][0]}` : `Spread over ${tables.size} tables`);
    } else if (r.type === "apart") {
      const ta = tableOf(r.a), tb = tableOf(r.b);
      push(r.id, r.type, description, !!ta && !!tb && ta !== tb, ta && tb ? (ta === tb ? `Both at ${ta}` : `At ${ta} and ${tb}`) : "Not seated");
    } else if (r.type === "head_table") {
      const heads = new Set(p.tables.filter((t) => t.head).map((t) => t.id));
      const bad = r.guests.filter((g) => !heads.has(tableOf(g) as string));
      push(r.id, r.type, description, bad.length === 0, bad.length ? `Not at a head table: ${bad.map(name).join(", ")}` : "All at the head table");
    } else {
      push(r.id, r.type, description, tableOf(r.guest) === r.table, `At ${tableOf(r.guest) ?? "no table"}`);
    }
  }
  const passed = results.filter((x) => x.ok).length;
  return { ok: passed === results.length, passed, total: results.length, results };
}

// ---------------------------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------------------------
interface Block {
  id: number;
  guests: string[];
  size: number;
  allowed: Set<string>;
  group?: string;
}

class UnionFind {
  private p = new Map<string, string>();
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r)!;
    this.p.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    this.p.set(this.find(a), this.find(b));
  }
}

interface Prepared {
  blocks: Block[];
  conflicts: Set<number>[];
  reasons: string[];
}

function prepare(p: SeatingProblem): Prepared {
  const reasons: string[] = [];
  const byId = new Map(p.guests.map((g) => [g.id, g]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const rules = withIds(p.rules);
  const uf = new UnionFind();
  for (const g of p.guests) uf.find(g.id);

  const partyMembers = new Map<string, string[]>();
  for (const g of p.guests) if (g.party) partyMembers.set(g.party, [...(partyMembers.get(g.party) ?? []), g.id]);
  for (const ids of partyMembers.values()) ids.slice(1).forEach((i) => uf.union(ids[0]!, i));

  for (const r of rules) {
    if (r.type !== "together") continue;
    const ids = r.guests ?? p.guests.filter((g) => (r.group ? g.group === r.group : g.party === r.party)).map((g) => g.id);
    const unknown = ids.filter((i) => !byId.has(i));
    if (unknown.length) reasons.push(`${r.id}: unknown guest ids ${unknown.join(", ")}`);
    ids.filter((i) => byId.has(i)).slice(1).forEach((i) => uf.union(ids[0]!, i));
  }

  const groups = new Map<string, string[]>();
  for (const g of p.guests) groups.set(uf.find(g.id), [...(groups.get(uf.find(g.id)) ?? []), g.id]);
  const blocks: Block[] = [...groups.values()].map((guests, id) => ({ id, guests, size: guests.length, allowed: new Set(p.tables.map((t) => t.id)), group: byId.get(guests[0]!)?.group }));
  const blockOf = new Map<string, Block>();
  for (const b of blocks) for (const g of b.guests) blockOf.set(g, b);
  const tableById = new Map(p.tables.map((t) => [t.id, t]));

  const restrict = (b: Block, allowed: Set<string>, why: string) => {
    b.allowed = new Set([...b.allowed].filter((t) => allowed.has(t)));
    if (b.allowed.size === 0) reasons.push(why);
  };
  for (const r of rules) {
    if (r.type === "fixed") {
      if (!tableById.has(r.table)) reasons.push(`${r.id}: unknown table "${r.table}"`);
      else if (byId.has(r.guest)) restrict(blockOf.get(r.guest)!, new Set([r.table]), `${r.id}: ${name(r.guest)} is fixed at ${r.table}, which conflicts with another rule on the same group of guests`);
    } else if (r.type === "head_table") {
      const heads = new Set(p.tables.filter((t) => t.head).map((t) => t.id));
      if (heads.size === 0) reasons.push(`${r.id}: head table rule given but no table is marked as the head table`);
      for (const g of r.guests) if (byId.has(g)) restrict(blockOf.get(g)!, heads, `${r.id}: ${name(g)} must sit at the head table, which conflicts with another rule`);
    }
  }
  for (const b of blocks) {
    const fit = new Set([...b.allowed].filter((t) => tableById.get(t)!.capacity >= b.size));
    if (fit.size === 0 && b.allowed.size > 0) {
      const biggest = Math.max(...[...b.allowed].map((t) => tableById.get(t)!.capacity));
      reasons.push(`${b.guests.map(name).join(", ")} must sit together (${b.size} people) but the largest allowed table seats ${biggest}`);
    }
    b.allowed = fit;
  }

  const conflicts: Set<number>[] = blocks.map(() => new Set());
  for (const r of rules) {
    if (r.type !== "apart") continue;
    if (!byId.has(r.a) || !byId.has(r.b)) {
      reasons.push(`${r.id}: unknown guest id in "keep apart"`);
      continue;
    }
    const x = blockOf.get(r.a)!, y = blockOf.get(r.b)!;
    if (x === y) reasons.push(`${r.id}: ${name(r.a)} and ${name(r.b)} must be apart but other rules force them to sit together`);
    else {
      conflicts[x.id]!.add(y.id);
      conflicts[y.id]!.add(x.id);
    }
  }
  const totalCap = p.tables.reduce((s, t) => s + t.capacity, 0);
  if (totalCap < p.guests.length) reasons.push(`${p.guests.length} guests but the tables seat only ${totalCap}`);
  return { blocks, conflicts, reasons };
}

interface Search { assignment: Map<number, string>; nodes: number; aborted: boolean }

function dfs(p: SeatingProblem, prep: Prepared, seed: number, nodeLimit: number): Search | null {
  const rand = rng(seed);
  const cap = new Map(p.tables.map((t) => [t.id, t.capacity]));
  const load = new Map<string, number>(p.tables.map((t) => [t.id, 0]));
  const members = new Map<string, number[]>(p.tables.map((t) => [t.id, []]));
  const assignment = new Map<number, string>();
  const noise = new Map(prep.blocks.map((b) => [b.id, rand()]));
  const order = [...prep.blocks].sort((a, b) => a.allowed.size - b.allowed.size || b.size - a.size || prep.conflicts[b.id]!.size - prep.conflicts[a.id]!.size || noise.get(a.id)! - noise.get(b.id)!);
  const tableNoise = new Map(p.tables.map((t) => [t.id, rand()]));
  let nodes = 0;
  let aborted = false;

  const go = (i: number): boolean => {
    if (i === order.length) return true;
    const b = order[i]!;
    const cands = [...b.allowed].filter((t) => load.get(t)! + b.size <= cap.get(t)! && !members.get(t)!.some((m) => prep.conflicts[b.id]!.has(m)));
    const sameGroup = (t: string) => (b.group ? members.get(t)!.some((m) => prep.blocks[m]!.group === b.group) : false);
    cands.sort((x, y) => Number(sameGroup(y)) - Number(sameGroup(x)) || cap.get(x)! - load.get(x)! - b.size - (cap.get(y)! - load.get(y)! - b.size) || tableNoise.get(x)! - tableNoise.get(y)!);
    for (const t of cands) {
      assignment.set(b.id, t);
      load.set(t, load.get(t)! + b.size);
      members.get(t)!.push(b.id);
      if (go(i + 1)) return true;
      members.get(t)!.pop();
      load.set(t, load.get(t)! - b.size);
      assignment.delete(b.id);
      if (++nodes > nodeLimit) {
        aborted = true;
        return false;
      }
      if (aborted) return false;
    }
    return false;
  };
  const ok = go(0);
  return ok ? { assignment, nodes, aborted } : aborted ? { assignment: new Map(), nodes, aborted } : null;
}

function groupSplits(p: SeatingProblem, a: Map<number, string>, blocks: Block[]): number {
  const tablesByGroup = new Map<string, Set<string>>();
  for (const b of blocks) {
    if (!b.group) continue;
    const t = a.get(b.id);
    if (t) tablesByGroup.set(b.group, (tablesByGroup.get(b.group) ?? new Set()).add(t));
  }
  return [...tablesByGroup.values()].reduce((s, set) => s + set.size - 1, 0);
}

function improve(p: SeatingProblem, prep: Prepared, a: Map<number, string>, seed: number, budget = 4000): void {
  const rand = rng(seed ^ 0x9e3779b9);
  const cap = new Map(p.tables.map((t) => [t.id, t.capacity]));
  const load = new Map<string, number>(p.tables.map((t) => [t.id, 0]));
  for (const b of prep.blocks) load.set(a.get(b.id)!, load.get(a.get(b.id)!)! + b.size);
  const tablesOf = (t: string, except: number) => prep.blocks.filter((x) => x.id !== except && a.get(x.id) === t);
  const feasibleAt = (b: Block, t: string, ignore?: number) =>
    b.allowed.has(t) && ![...prep.conflicts[b.id]!].some((o) => o !== ignore && a.get(o) === t);
  const score = () => groupSplits(p, a, prep.blocks) * 10 + [...load.entries()].reduce((s, [t, l]) => s + (l / cap.get(t)! - 0.8) ** 2, 0);
  let best = score();
  for (let it = 0; it < budget; it++) {
    const b = prep.blocks[Math.floor(rand() * prep.blocks.length)]!;
    const from = a.get(b.id)!;
    const to = p.tables[Math.floor(rand() * p.tables.length)]!.id;
    if (to === from) continue;
    if (load.get(to)! + b.size <= cap.get(to)! && feasibleAt(b, to)) {
      a.set(b.id, to);
      load.set(from, load.get(from)! - b.size);
      load.set(to, load.get(to)! + b.size);
      const s = score();
      if (s < best) best = s;
      else {
        a.set(b.id, from);
        load.set(from, load.get(from)! + b.size);
        load.set(to, load.get(to)! - b.size);
      }
      continue;
    }
    // swap with a random block at the target table
    const others = tablesOf(to, b.id);
    if (!others.length) continue;
    const o = others[Math.floor(rand() * others.length)]!;
    const newFrom = load.get(from)! - b.size + o.size, newTo = load.get(to)! - o.size + b.size;
    if (newFrom > cap.get(from)! || newTo > cap.get(to)!) continue;
    if (!feasibleAt(b, to, o.id) || !feasibleAt(o, from, b.id)) continue;
    a.set(b.id, to);
    a.set(o.id, from);
    load.set(from, newFrom);
    load.set(to, newTo);
    const s = score();
    if (s < best) best = s;
    else {
      a.set(b.id, from);
      a.set(o.id, to);
      load.set(from, newFrom - o.size + b.size);
      load.set(to, newTo - b.size + o.size);
    }
  }
}

function toAssignment(prep: Prepared, a: Map<number, string>): Assignment {
  const out: Assignment = {};
  for (const b of prep.blocks) for (const g of b.guests) if (a.get(b.id)) out[g] = a.get(b.id)!;
  return out;
}

function seatOrder(p: SeatingProblem, assignment: Assignment): Record<string, string[]> {
  const seats: Record<string, string[]> = Object.fromEntries(p.tables.map((t) => [t.id, [] as string[]]));
  const sorted = [...p.guests].sort((x, y) => (x.group ?? "").localeCompare(y.group ?? "") || (x.party ?? "").localeCompare(y.party ?? "") || x.name.localeCompare(y.name));
  for (const g of sorted) if (assignment[g.id]) seats[assignment[g.id]!]!.push(g.id);
  return seats;
}

export interface SolveOptions { seed?: number; restarts?: number; nodeLimit?: number }

function trySolve(p: SeatingProblem, opts: Required<SolveOptions>) {
  const prep = prepare(p);
  if (prep.reasons.length) return { prep, found: null as Map<number, string> | null, nodes: 0, exhausted: true, restarts: 0 };
  let nodes = 0, exhaustedAll = true, r = 0;
  for (; r < opts.restarts; r++) {
    const res = dfs(p, prep, opts.seed + r * 7919, opts.nodeLimit);
    if (res && res.assignment.size === prep.blocks.length) {
      improve(p, prep, res.assignment, opts.seed);
      return { prep, found: res.assignment, nodes: nodes + res.nodes, exhausted: false, restarts: r + 1 };
    }
    nodes += res?.nodes ?? 0;
    // A DFS that finished without hitting the node limit proves infeasibility for this block order.
    if (!res || !res.aborted) return { prep, found: null, nodes, exhausted: true, restarts: r + 1 };
    exhaustedAll = false;
  }
  return { prep, found: null, nodes, exhausted: exhaustedAll, restarts: r };
}

export function solveSeating(problem: SeatingProblem, options: SolveOptions = {}): SeatingResult {
  const opts: Required<SolveOptions> = { seed: options.seed ?? 1, restarts: options.restarts ?? 12, nodeLimit: options.nodeLimit ?? 40_000 };
  const rules = withIds(problem.rules);
  const p: SeatingProblem = { ...problem, rules };
  const first = trySolve(p, opts);

  if (first.found) {
    const assignment = toAssignment(first.prep, first.found);
    return {
      status: "solved",
      assignment,
      seats: seatOrder(p, assignment),
      report: verifySeating(p, assignment),
      conflicts: [],
      relaxedRules: [],
      stats: { blocks: first.prep.blocks.length, nodes: first.nodes, restarts: first.restarts, groupSplits: groupSplits(p, first.found, first.prep.blocks), exhausted: false },
    };
  }

  // Infeasible (or not found within budget): explain, then find the rules whose removal makes it solvable.
  const conflicts = [...first.prep.reasons];
  const relaxed: string[] = [];
  const cheap = { ...opts, restarts: 3, nodeLimit: 8000 };
  let working = [...rules];
  const removable = rules.filter((r) => ["apart", "together", "fixed", "head_table"].includes(r.type));
  let result = trySolve({ ...p, rules: working }, cheap);
  for (const r of removable) {
    if (result.found) break;
    working = working.filter((w) => w.id !== r.id);
    result = trySolve({ ...p, rules: working }, cheap);
    relaxed.push(r.id!);
  }
  // Greedy removal can over-remove; keep only rules that are actually needed to restore feasibility.
  const needed: string[] = [];
  if (result.found) {
    for (const id of relaxed) {
      const withBack = [...working, rules.find((r) => r.id === id)!];
      if (!trySolve({ ...p, rules: withBack }, cheap).found) {
        needed.push(id);
      } else working = withBack;
    }
  }
  const assignment = result.found ? toAssignment(result.prep, result.found) : {};
  const nameOf = (id: string) => rules.find((r) => r.id === id)!;
  const byId = new Map(p.guests.map((g) => [g.id, g]));
  const gname = (id: string) => byId.get(id)?.name ?? id;
  if (!conflicts.length) {
    conflicts.push(
      first.exhausted
        ? "No seating satisfies all the rules together."
        : "No seating was found within the search limit; the rules may be too tight to satisfy together.",
    );
  }
  if (needed.length) conflicts.push(`These rules cannot all hold together: ${needed.map((id) => `${id} (${describeRule(nameOf(id), gname)})`).join("; ")}. Relax or remove one to continue.`);
  return {
    status: "infeasible",
    assignment,
    seats: seatOrder(p, assignment),
    report: verifySeating(p, assignment),
    conflicts,
    relaxedRules: needed,
    stats: { blocks: first.prep.blocks.length, nodes: first.nodes, restarts: first.restarts, groupSplits: 0, exhausted: first.exhausted },
  };
}

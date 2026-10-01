import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, solveSeating, verifySeating, type Guest, type Rule, type SeatingProblem, type Table } from "./index.ts";

const mkTables = (n: number, cap: number, heads = 0): Table[] => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Table ${i + 1}`, capacity: cap, head: i < heads }));
const mkGuests = (n: number): Guest[] => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, name: `Guest ${i + 1}` }));

test("basic: solves, verifies, and reports each rule", () => {
  const guests: Guest[] = [
    { id: "a", name: "Ana", group: "fam", party: "p1" }, { id: "b", name: "Ben", group: "fam", party: "p1" },
    { id: "c", name: "Cy", group: "fam" }, { id: "d", name: "Di", group: "fr" }, { id: "e", name: "Eli", group: "fr" }, { id: "f", name: "Fay", group: "fr" },
  ];
  const rules: Rule[] = [{ type: "apart", a: "c", b: "d" }, { type: "together", guests: ["d", "e"] }, { type: "fixed", guest: "f", table: "t2" }];
  const res = solveSeating({ guests, tables: mkTables(2, 3), rules });
  assert.equal(res.status, "solved");
  assert.equal(res.report.ok, true);
  assert.equal(res.assignment.a, res.assignment.b); // party kept together
  assert.equal(res.assignment.f, "t2");
  assert.notEqual(res.assignment.c, res.assignment.d);
  assert.ok(res.report.total >= 6 && res.report.passed === res.report.total);
  assert.deepEqual(Object.values(res.seats).flat().sort(), guests.map((g) => g.id).sort());
});

test("verifier: catches each kind of violation", () => {
  const guests = mkGuests(6);
  const tables = mkTables(2, 4, 1);
  const rules: Rule[] = [{ type: "apart", a: "g1", b: "g2" }, { type: "together", guests: ["g3", "g4"] }, { type: "head_table", guests: ["g5"] }, { type: "fixed", guest: "g6", table: "t2" }];
  const p: SeatingProblem = { guests, tables, rules };
  const good = { g1: "t1", g2: "t2", g3: "t1", g4: "t1", g5: "t1", g6: "t2" };
  assert.equal(verifySeating(p, good).ok, true);
  assert.equal(verifySeating(p, { ...good, g2: "t1" }).ok, false, "apart violated");
  assert.equal(verifySeating(p, { ...good, g4: "t2" }).ok, false, "together violated");
  assert.equal(verifySeating(p, { ...good, g5: "t2" }).ok, false, "head table violated");
  assert.equal(verifySeating(p, { ...good, g6: "t1" }).ok, false, "fixed violated");
  const { g1, ...missing } = good;
  assert.equal(verifySeating(p, missing).ok, false, "unseated guest");
  assert.equal(verifySeating(p, { ...good, g2: "t1", g3: "t1", g4: "t1", g1: "t1" }).ok, false, "over capacity");
  assert.equal(verifySeating(p, { ...good, g1: "nope" }).ok, false, "unknown table");
});

test("property: rules derived from a hidden valid seating are always solvable and verified", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 101);
    const nTables = 4 + Math.floor(r() * 14);
    const cap = 6 + Math.floor(r() * 5);
    const heads = r() < 0.4 ? 1 : 0;
    const tables = mkTables(nTables, cap, heads);
    const nGuests = Math.floor(nTables * cap * (0.7 + r() * 0.3)); // up to 100% full
    const guests = mkGuests(nGuests).map((g, i) => ({ ...g, group: `grp${i % 7}` }));
    const hidden: Record<string, string> = {};
    const load = new Map(tables.map((t) => [t.id, 0]));
    for (const g of guests) {
      const open = tables.filter((t) => load.get(t.id)! < t.capacity);
      const t = open[Math.floor(r() * open.length)]!;
      hidden[g.id] = t.id;
      load.set(t.id, load.get(t.id)! + 1);
    }
    const rules: Rule[] = [];
    const pick = () => guests[Math.floor(r() * guests.length)]!;
    for (let i = 0; i < 12; i++) {
      const a = pick(), b = pick();
      if (a.id === b.id) continue;
      rules.push(hidden[a.id] === hidden[b.id] ? { type: "together", guests: [a.id, b.id] } : { type: "apart", a: a.id, b: b.id });
    }
    for (let i = 0; i < 4; i++) {
      const g = pick();
      rules.push({ type: "fixed", guest: g.id, table: hidden[g.id]! });
    }
    if (heads) rules.push({ type: "head_table", guests: guests.filter((g) => hidden[g.id] === "t1").slice(0, 3).map((g) => g.id) });
    const res = solveSeating({ guests, tables, rules }, { seed });
    assert.equal(res.status, "solved", `seed ${seed}: ${res.conflicts.join(" | ")}`);
    assert.equal(res.report.ok, true, `seed ${seed}: report not ok`);
    // independent re-verification of the returned assignment
    assert.equal(verifySeating({ guests, tables, rules }, res.assignment).ok, true);
  }
});

test("property: corrupting a solved seating is always detected by the verifier", () => {
  const guests = mkGuests(40);
  const tables = mkTables(5, 8);
  const rules: Rule[] = [];
  for (let i = 0; i < 10; i++) rules.push({ type: "apart", a: `g${i * 2 + 1}`, b: `g${i * 2 + 2}` });
  const p = { guests, tables, rules };
  const res = solveSeating(p);
  assert.equal(res.status, "solved");
  for (let i = 0; i < 10; i++) {
    const bad = { ...res.assignment, [`g${i * 2 + 2}`]: res.assignment[`g${i * 2 + 1}`]! };
    assert.equal(verifySeating(p, bad).ok, false);
  }
});

test("infeasible: oversized group, apart-within-together, capacity, missing head table, unknown ids", () => {
  const g = mkGuests(10);
  const big = solveSeating({ guests: g, tables: mkTables(5, 4), rules: [{ type: "together", guests: g.slice(0, 6).map((x) => x.id) }] });
  assert.equal(big.status, "infeasible");
  assert.match(big.conflicts.join(" "), /seats 4/);

  const clash = solveSeating({ guests: g, tables: mkTables(3, 4), rules: [{ type: "together", guests: ["g1", "g2"] }, { type: "apart", a: "g1", b: "g2" }] });
  assert.equal(clash.status, "infeasible");
  assert.match(clash.conflicts.join(" "), /must be apart but other rules force them/);

  const cap = solveSeating({ guests: g, tables: mkTables(2, 4), rules: [] });
  assert.equal(cap.status, "infeasible");
  assert.match(cap.conflicts.join(" "), /seat only 8/);

  const head = solveSeating({ guests: g, tables: mkTables(3, 4), rules: [{ type: "head_table", guests: ["g1"] }] });
  assert.equal(head.status, "infeasible");
  assert.match(head.conflicts.join(" "), /no table is marked as the head table/);

  const unk = solveSeating({ guests: g, tables: mkTables(3, 4), rules: [{ type: "apart", a: "g1", b: "zzz" }] });
  assert.equal(unk.status, "infeasible");
  assert.match(unk.conflicts.join(" "), /unknown guest/);
});

test("infeasible: names the conflicting rules and still returns a best-effort chart", () => {
  const guests = mkGuests(6);
  // g1,g2,g3 must be together (3) but g1-g2 apart is not directly contradictory; use a pigeonhole instead:
  // 3 tables of 2, guests g1..g3 pairwise apart is fine; add g4 apart from all three and a 4th mutual conflict.
  const tables = mkTables(3, 2);
  const rules: Rule[] = [];
  for (const [a, b] of [["g1", "g2"], ["g1", "g3"], ["g1", "g4"], ["g2", "g3"], ["g2", "g4"], ["g3", "g4"]]) rules.push({ type: "apart", a: a!, b: b! });
  const res = solveSeating({ guests, tables, rules });
  assert.equal(res.status, "infeasible"); // four mutually-apart guests need four tables
  assert.ok(res.relaxedRules.length >= 1, "identifies at least one rule to relax");
  assert.match(res.conflicts.join(" "), /cannot all hold together/);
  assert.equal(res.report.ok, false);
  assert.ok(Object.keys(res.assignment).length > 0, "best-effort assignment is provided");
});

test("deterministic for a fixed seed and fast at 250 guests / 30 tables", () => {
  const guests = mkGuests(250).map((g, i) => ({ ...g, group: `g${i % 12}`, party: i % 5 === 0 ? `p${Math.floor(i / 5)}` : undefined }));
  const tables = mkTables(30, 9);
  const rules: Rule[] = [{ type: "apart", a: "g1", b: "g2" }, { type: "apart", a: "g10", b: "g20" }];
  const t0 = performance.now();
  const a = solveSeating({ guests, tables, rules }, { seed: 7 });
  const ms = performance.now() - t0;
  const b = solveSeating({ guests, tables, rules }, { seed: 7 });
  assert.equal(a.status, "solved");
  assert.deepEqual(a.assignment, b.assignment);
  assert.ok(ms < 1500, `took ${ms.toFixed(0)} ms`);
});

test("soft objective: groups are kept together when capacity allows", () => {
  const guests: Guest[] = [];
  for (const [grp, n] of [["A", 4], ["B", 4], ["C", 4]] as const) for (let i = 0; i < n; i++) guests.push({ id: `${grp}${i}`, name: `${grp}${i}`, group: grp });
  const res = solveSeating({ guests, tables: mkTables(3, 4), rules: [] });
  assert.equal(res.status, "solved");
  assert.equal(res.stats.groupSplits, 0);
});

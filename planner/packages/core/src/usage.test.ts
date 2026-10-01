import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { COST_MODEL, DEFAULT_LIMITS, USAGE_MIGRATION, UsageGuard, gateRequest, limitsFromEnv, takeSolve, type D1Like } from "./index.ts";

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(USAGE_MIGRATION);
  const writes = { n: 0 };
  const d1: D1Like = {
    prepare(sql: string) {
      return { bind(...v: unknown[]) { return {
        async run() { const r = db.prepare(sql).run(...(v as never[])); writes.n += Number(r.changes); return r; },
        async first<T>() { const row = (db.prepare(sql).get(...(v as never[])) as T | undefined) ?? null; if (row && /^UPDATE/.test(sql)) writes.n++; return row; },
      }; } };
    },
  };
  return { d1, db, writes };
}

test("the defaults keep both products inside the included monthly CPU allowance, even in the worst case", () => {
  const c = COST_MODEL, d = DEFAULT_LIMITS;
  const perProductPerDay = d.requestsPerDay * c.worstCpuMsPerRequest + d.solvesPerDay * c.cpuMsLimitPerInvocation;
  const perMonth = perProductPerDay * c.products * c.daysPerMonth;
  assert.ok(perMonth <= c.includedCpuMsPerMonth, `worst case ${perMonth} CPU ms exceeds the included ${c.includedCpuMsPerMonth}`);
  assert.ok(d.requestsPerDay * c.products * c.daysPerMonth <= c.includedRequestsPerMonth, "request cap fits the included requests");
});

test("allows exactly the limit, then refuses, with the time until reset", async () => {
  const { d1 } = fakeD1();
  const noon = Date.UTC(2026, 9, 1, 12, 0, 0);
  const g = new UsageGuard(d1, { requestsPerDay: 3, solvesPerDay: 2 }, () => noon);
  for (let i = 1; i <= 3; i++) assert.deepEqual(await g.take("req"), { ok: true, used: i });
  const over = await g.take("req");
  assert.equal(over.ok, false);
  if (!over.ok) { assert.equal(over.limit, 3); assert.equal(over.retryAfterSeconds, 12 * 3600); }
  assert.equal((await g.take("solve")).ok, true, "the solver allowance is separate");
});

test("the allowance resets at midnight UTC", async () => {
  const { d1 } = fakeD1();
  let t = Date.UTC(2026, 9, 1, 23, 59, 0);
  const g = new UsageGuard(d1, { requestsPerDay: 1, solvesPerDay: 1 }, () => t);
  assert.equal((await g.take("req")).ok, true);
  assert.equal((await g.take("req")).ok, false);
  t = Date.UTC(2026, 9, 2, 0, 0, 1);
  assert.equal((await g.take("req")).ok, true);
});

test("once the cap is reached, further requests write nothing", async () => {
  const { d1, writes } = fakeD1();
  const g = new UsageGuard(d1, { requestsPerDay: 5, solvesPerDay: 5 }, () => Date.UTC(2026, 9, 1));
  for (let i = 0; i < 5; i++) await g.take("req");
  const before = writes.n;
  for (let i = 0; i < 200; i++) assert.equal((await g.take("req")).ok, false);
  assert.equal(writes.n, before, "no rows written after the cap");
});

test("concurrent calls never exceed the limit", async () => {
  const { d1 } = fakeD1();
  const g = new UsageGuard(d1, { requestsPerDay: 10, solvesPerDay: 10 }, () => Date.UTC(2026, 9, 1));
  const results = await Promise.all(Array.from({ length: 50 }, () => g.take("req")));
  assert.equal(results.filter((r) => r.ok).length, 10);
});

test("gateRequest: 429 with Retry-After at the cap; the challenge route and preflights are never counted; a broken counter fails closed", async () => {
  const { d1 } = fakeD1();
  const g = new UsageGuard(d1, { requestsPerDay: 1, solvesPerDay: 1 }, () => Date.UTC(2026, 9, 1, 6));
  const req = (m = "POST") => new Request("https://x.dev/mcp", { method: m });
  assert.equal(await gateRequest(g, req(), "/mcp"), null);
  const blocked = (await gateRequest(g, req(), "/mcp"))!;
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), String(18 * 3600));
  assert.match(((await blocked.json()) as { error: string }).error, /daily capacity/);
  assert.equal(await gateRequest(g, req("GET"), "/.well-known/openai-apps-challenge"), null);
  assert.equal(await gateRequest(g, req("OPTIONS"), "/mcp"), null);
  const broken = new UsageGuard({ prepare: () => { throw new Error("D1 down"); } } as unknown as D1Like, DEFAULT_LIMITS);
  assert.equal((await gateRequest(broken, req(), "/mcp"))!.status, 503);
});

test("takeSolve explains the limit in words the model can relay", async () => {
  const { d1 } = fakeD1();
  const g = new UsageGuard(d1, { requestsPerDay: 9, solvesPerDay: 1 }, () => Date.UTC(2026, 9, 1));
  await takeSolve(g);
  await assert.rejects(() => takeSolve(g), /daily limit of 1 layout or seating plans.*00:00 UTC.*still work/);
});

test("limits come from the environment, and bad values fall back to the defaults", () => {
  assert.deepEqual(limitsFromEnv({ DAILY_REQUEST_LIMIT: "500", DAILY_SOLVE_LIMIT: "7" }), { requestsPerDay: 500, solvesPerDay: 7 });
  assert.deepEqual(limitsFromEnv({ DAILY_REQUEST_LIMIT: "-1", DAILY_SOLVE_LIMIT: "abc" }), DEFAULT_LIMITS);
  assert.deepEqual(limitsFromEnv({}), DEFAULT_LIMITS);
});

test("old usage rows are purged", async () => {
  const { d1, db } = fakeD1();
  db.prepare("INSERT INTO usage VALUES ('2026-01-01','req',5), ('2026-09-30','req',5)").run();
  await new UsageGuard(d1, DEFAULT_LIMITS, () => Date.UTC(2026, 9, 1)).purgeOld(40);
  assert.deepEqual(db.prepare("SELECT day FROM usage").all().map((r) => (r as { day: string }).day), ["2026-09-30"]);
});

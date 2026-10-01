import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { PlanStore, PLANS_MIGRATION, PLAN_TTL_DAYS, handlePlansApi, type D1Like } from "./index.ts";

/** Adapter that gives node:sqlite the D1 prepare/bind/run/first shape. */
function fakeD1(): D1Like {
  const db = new DatabaseSync(":memory:");
  db.exec(PLANS_MIGRATION);
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() { return db.prepare(sql).run(...(values as never[])); },
            async first<T>() { return (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null; },
          };
        },
      };
    },
  };
}
const newStore = () => { let t = 1_000_000; const clock = { now: () => t, advance: (s: number) => (t += s) }; return { store: new PlanStore(fakeD1(), clock.now), clock }; };

test("create, get, update, remove with the manage token", async () => {
  const { store } = newStore();
  const { id, manageToken } = await store.create("room", { hello: "world" });
  assert.match(id, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(manageToken.length >= 30);
  assert.deepEqual((await store.get(id))!.data, { hello: "world" });
  assert.equal(await store.update(id, "wrong-token-wrong-token", { x: 1 }), false);
  assert.equal(await store.update(id, "", { x: 1 }), false);
  assert.equal(await store.update(id, manageToken, { x: 2 }), true);
  assert.deepEqual((await store.get(id))!.data, { x: 2 });
  assert.equal(await store.remove(id, "nope-nope-nope-nope"), false);
  assert.equal(await store.remove(id, manageToken), true);
  assert.equal(await store.get(id), null);
});

test("only a hash of the token is stored", async () => {
  const db = fakeD1();
  const store = new PlanStore(db);
  const { id, manageToken } = await store.create("room", {});
  const row = await db.prepare("SELECT manage_hash FROM plans WHERE id = ?").bind(id).first<{ manage_hash: string }>();
  assert.ok(row && !row.manage_hash.includes(manageToken) && /^[0-9a-f]{64}$/.test(row.manage_hash));
});

test("plans expire 90 days after the last edit and editing extends the life", async () => {
  const { store, clock } = newStore();
  const { id, manageToken } = await store.create("seating", { a: 1 });
  clock.advance((PLAN_TTL_DAYS - 1) * 86_400);
  assert.ok(await store.get(id), "still there on day 89");
  assert.equal(await store.update(id, manageToken, { a: 2 }), true);
  clock.advance(2 * 86_400);
  assert.ok(await store.get(id), "edit on day 89 extended the life past day 91");
  clock.advance(PLAN_TTL_DAYS * 86_400);
  assert.equal(await store.get(id), null, "expired");
  assert.equal(await store.update(id, manageToken, {}), false, "cannot edit an expired plan");
  const other = await store.create("room", {});
  clock.advance(PLAN_TTL_DAYS * 86_400 + 1);
  await store.purgeExpired();
  assert.equal(await store.get(other.id), null);
});

test("ids are validated and sizes are limited", async () => {
  const { store } = newStore();
  assert.equal(await store.get("short"), null);
  assert.equal(await store.get("../../etc/passwd/xxxxxxxxxxxx"), null);
  assert.equal(await store.get("a'; DROP TABLE plans;--aaaaaaa"), null);
  await assert.rejects(store.create("room", { big: "x".repeat(250_000) }), RangeError);
  const { id, manageToken } = await store.create("room", {});
  await assert.rejects(store.update(id, manageToken, { big: "x".repeat(250_000) }), RangeError);
});

test("HTTP API: create, read, edit, delete, and rejection paths", async () => {
  const { store } = newStore();
  const opts = { kinds: ["room"], validate: (_k: string, d: unknown) => { if (typeof d !== "object" || d === null) throw new RangeError("Plan data must be an object"); } };
  const call = (method: string, path: string, body?: unknown, token?: string) =>
    handlePlansApi(new Request(`https://x.test${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: token ? { "x-manage-token": token } : {} }), store, opts);
  const created = await call("POST", "/api/plans", { kind: "room", data: { v: 1 } });
  assert.equal(created.status, 201);
  const { id, manageToken } = (await created.json()) as { id: string; manageToken: string };
  assert.equal((await call("GET", `/api/plans/${id}`)).status, 200);
  const got = (await (await call("GET", `/api/plans/${id}`)).json()) as { data: unknown; manageToken?: string };
  assert.deepEqual(got.data, { v: 1 });
  assert.equal(JSON.stringify(got).includes(manageToken), false, "the token is never returned by GET");
  assert.equal((await call("PUT", `/api/plans/${id}`, { data: { v: 2 } })).status, 403, "no token");
  assert.equal((await call("PUT", `/api/plans/${id}`, { data: { v: 2 } }, "wrong-wrong-wrong-wrong")).status, 403);
  assert.equal((await call("PUT", `/api/plans/${id}`, { data: { v: 2 } }, manageToken)).status, 200);
  assert.equal((await call("PUT", `/api/plans/${id}`, { data: "string" }, manageToken)).status, 400, "validation error is surfaced");
  assert.equal((await call("POST", "/api/plans", { kind: "nope", data: {} })).status, 400);
  assert.equal((await call("POST", "/api/plans", { kind: "room", data: 5 })).status, 400);
  assert.equal((await call("GET", "/api/plans")).status, 405);
  assert.equal((await call("DELETE", `/api/plans/${id}`, undefined, "wrong-wrong-wrong-wrong")).status, 403);
  assert.equal((await call("DELETE", `/api/plans/${id}`, undefined, manageToken)).status, 200);
  assert.equal((await call("GET", `/api/plans/${id}`)).status, 404);
  const bad = await handlePlansApi(new Request("https://x.test/api/plans", { method: "POST", body: "{not json" }), store, opts);
  assert.equal(bad.status, 400);
});

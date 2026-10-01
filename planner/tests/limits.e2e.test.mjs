// The daily circuit breaker, end to end on workerd: solver cap, request cap, what stays available, and the reset message.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startWorker, mcpClient } from "./helpers.mjs";

const persist = await mkdtemp(`${tmpdir()}/limits-`);
const w = startWorker("apps/home", 8809, 9409, ["--var", "DAILY_SOLVE_LIMIT:2", "--var", "DAILY_REQUEST_LIMIT:12"], { persist });
const { call } = mcpClient(w.base);
before(async () => { await w.ready(); });
after(() => w.stop());

const room = { unit: "in", save: false, room: { width: 168, length: 144, doors: [{ wall: "south", offset: 96, width: 32 }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 84, depth: 36 }] };

test("the solver allowance stops plan_room_layout after the limit, with a message the model can relay; other tools keep working", async () => {
  assert.ok(!(await call("plan_room_layout", room)).isError);
  assert.ok(!(await call("plan_room_layout", room)).isError);
  const third = await call("plan_room_layout", room);
  assert.equal(third.isError, true);
  assert.match(third.content[0].text, /daily limit of 2 layout or seating plans.*00:00 UTC/);
  const est = await call("estimate_room_materials", { unit: "ft", room: { width: 12, length: 10 } });
  assert.ok(!est.isError, "estimates are not solver calls");
});

test("the request allowance returns 429 with Retry-After, never counts the challenge route, and leaves static pages alone", async () => {
  // 5 requests used so far (4 tool calls above, plus the readiness probe is a static page and is not counted).
  let ok = 0, blocked;
  for (let i = 0; i < 30 && !blocked; i++) {
    const r = await fetch(`${w.base}/api/plans/abcdefghijklmnopqrstuv`);
    if (r.status === 429) blocked = r; else { assert.equal(r.status, 404); ok++; }
  }
  assert.ok(blocked, "a 429 arrived");
  assert.equal(ok + 4, 12, `exactly the 12 allowed dynamic requests were served (got ${ok + 4})`);
  assert.match(blocked.headers.get("retry-after"), /^\d+$/);
  assert.ok(Number(blocked.headers.get("retry-after")) <= 86400);
  assert.match((await blocked.json()).error, /daily capacity/);
  // MCP is refused too, as a clean HTTP 429
  const mcp = await fetch(`${w.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  assert.equal(mcp.status, 429);
  // never counted or blocked: domain verification, preflight, static pages
  assert.equal((await fetch(`${w.base}/.well-known/openai-apps-challenge`)).status, 404, "reaches the handler (404 only because no token is set)");
  assert.equal((await fetch(`${w.base}/mcp`, { method: "OPTIONS" })).status, 204);
  for (const p of ["/", "/privacy/", "/app/", "/style.css"]) assert.equal((await fetch(`${w.base}${p}`)).status, 200, p);
});

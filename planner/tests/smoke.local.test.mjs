// Proves the post-deploy smoke script itself works, against local workers (one with a challenge token, one without).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { startWorker } from "./helpers.mjs";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const TOKEN = "tok_Test-123.abc";
const a = startWorker("apps/home", 8807, 9407, ["--var", `OPENAI_APPS_CHALLENGE:${TOKEN}`]);
const b = startWorker("apps/wedding", 8808, 9408);
before(async () => { await Promise.all([a.ready(), b.ready()]); });
after(() => { a.stop(); b.stop(); });

const run = (base, app, ...args) => spawnSync("node", ["scripts/smoke.mjs", base, app, ...args], { encoding: "utf8" });

test("smoke passes on roomwise with the challenge token configured", () => {
  const r = run(a.base, "home", `--challenge=${TOKEN}`, "--waitlist", "--wait=30");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SMOKE PASSED/);
  assert.match(r.stdout, /challenge route returns exactly the token/);
});
test("smoke passes on aisle with no challenge configured", () => {
  const r = run(b.base, "wedding");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /challenge route is 404: no verification token is configured yet/);
});
test("smoke accepts a configured token when none is passed (secrets survive redeploys), and still checks the value when one is", () => {
  const r = run(a.base, "home");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /serves a token as text\/plain/);
  assert.match(r.stdout, /live tool names, schemas and descriptions match this checkout/);
});
test("smoke fails loudly when the expected token is wrong", () => {
  const r = run(a.base, "home", "--challenge=not-the-token");
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /FAIL challenge route/);
});

test("smoke explains a Worker that never answers, instead of reporting a wall of failures", () => {
  const r = run("http://127.0.0.1:9", "home", "--wait=3");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /still not answering after 3 s/);
  assert.match(r.stderr, /Domains & Routes/);
  assert.doesNotMatch(r.stdout, /^FAIL /m);
});

test("smoke reports exactly what differs when the live tool descriptions do not match this checkout", () => {
  const snap = JSON.parse(readFileSync("apps/wedding/plugin/tools.snapshot.json", "utf8"));
  snap[0].description = "An older description of this tool.";
  const file = `${mkdtempSync(`${tmpdir()}/snap-`)}/snap.json`;
  writeFileSync(file, JSON.stringify(snap));
  const r = run(b.base, "wedding", `--snapshot=${file}`, "--wait=3");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /waiting for the new version to roll out/);
  assert.match(r.stdout, /FAIL live tool names.*description changed/s);
  assert.match(r.stdout, /live    : "Use this when the user wants a wedding or reception seating chart/);
  assert.match(r.stdout, /expected: "An older description/);
});

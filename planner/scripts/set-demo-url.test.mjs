import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const home = mkdtempSync(`${tmpdir()}/demo-`);
const base = { PATH: process.env.PATH, HOME: home };
const setUrl = (...args) => spawnSync("node", ["scripts/set-demo-url.mjs", ...args, "--no-check"], { cwd, env: base, encoding: "utf8" });
const pack = (env = {}) => spawnSync("node", ["scripts/package-plugins.ts", "--no-copy"], { cwd, env: { ...base, PUBLISHER_NAME: "Acme Ltd", CONTACT_EMAIL: "help@acme.dev", ROOMWISE_URL: "https://roomwise.acme.workers.dev", AISLE_URL: "https://aisle.acme.workers.dev", ...env }, encoding: "utf8" });
const manifest = (zip) => JSON.parse(spawnSync("unzip", ["-p", `${cwd}dist/plugins/${zip}`, "plugin.json"], { encoding: "utf8" }).stdout);

test("rejects links that are not usable by a signed-out reviewer", () => {
  assert.match(setUrl("roomwise", "http://example.org/v").stderr, /must start with https/);
  assert.match(setUrl("roomwise", "https://user:pw@example.org/v").stderr, /username or password/);
  assert.match(setUrl("roomwise", "not a link").stderr, /not a web address/);
  assert.match(setUrl("nonsense", "https://example.org/v").stderr, /Choose roomwise or aisle|interactive terminal/);
});
test("a saved link goes into the ZIP's manifest, per product; the environment overrides it", () => {
  assert.equal(setUrl("roomwise", "https://youtu.be/abc123").status, 0);
  assert.equal(setUrl("aisle", "https://www.loom.com/share/xyz").status, 0);
  assert.equal(JSON.parse(readFileSync(`${home}/.config/planner/profile.json`, "utf8")).demoUrls.roomwise, "https://youtu.be/abc123");
  const r = pack();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(manifest("roomwise-1.0.0.zip").extensions["com.openai"].review.demo_recording_url, "https://youtu.be/abc123");
  assert.equal(manifest("aisle-seating-1.0.0.zip").extensions["com.openai"].review.demo_recording_url, "https://www.loom.com/share/xyz");
  assert.ok(!r.stdout.includes("demo_recording_url is not set"));
  pack({ DEMO_URL_ROOMWISE: "https://youtu.be/override" });
  assert.equal(manifest("roomwise-1.0.0.zip").extensions["com.openai"].review.demo_recording_url, "https://youtu.be/override");
});
test("saving a demo link keeps the publisher details already remembered", () => {
  const h = mkdtempSync(`${tmpdir()}/demo-`);
  mkdirSync(`${h}/.config/planner`, { recursive: true });
  writeFileSync(`${h}/.config/planner/profile.json`, JSON.stringify({ publisher: "Acme Ltd", email: "help@acme.dev" }));
  const r = spawnSync("node", ["scripts/set-demo-url.mjs", "aisle", "https://youtu.be/q", "--no-check"], { cwd, env: { PATH: process.env.PATH, HOME: h }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(readFileSync(`${h}/.config/planner/profile.json`, "utf8"));
  assert.deepEqual({ publisher: p.publisher, email: p.email, aisle: p.demoUrls.aisle }, { publisher: "Acme Ltd", email: "help@acme.dev", aisle: "https://youtu.be/q" });
});

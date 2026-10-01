import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync as _e, mkdirSync as _m, mkdtempSync } from "node:fs";
const require_fs = () => ({ existsSync: _e, mkdirSync: _m });
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./package-plugins.ts", import.meta.url));
const cwd = fileURLToPath(new URL("..", import.meta.url));
const base = { PATH: process.env.PATH, HOME: mkdtempSync(`${tmpdir()}/nohome-`) };
const run = (env, ...args) => spawnSync("node", [script, ...args], { cwd, env: { ...base, ...env }, encoding: "utf8" });
const manifest = (zip) => JSON.parse(spawnSync("unzip", ["-p", zip, "plugin.json"], { encoding: "utf8" }).stdout);

test("refuses to build a ZIP when it cannot tell where the plugin is deployed", () => {
  const r = run({ PUBLISHER_NAME: "Acme Ltd", CONTACT_EMAIL: "help@acme.dev" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /placeholder address must never be uploaded/);
});
test("uses the real URLs and the category from the environment", () => {
  const r = run({ PUBLISHER_NAME: "Acme Ltd", CONTACT_EMAIL: "help@acme.dev", ROOMWISE_URL: "https://roomwise.acme.workers.dev", AISLE_URL: "https://aisle.acme.workers.dev", PLUGIN_CATEGORY_ROOMWISE: "Home & Garden", PLUGIN_CATEGORY: "Events" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const home = manifest(`${cwd}dist/plugins/roomwise-1.0.0.zip`), wed = manifest(`${cwd}dist/plugins/aisle-seating-1.0.0.zip`);
  assert.equal(home.extensions["com.openai"].interface.category, "Home & Garden", "the per-product setting wins");
  assert.equal(wed.extensions["com.openai"].interface.category, "Events", "the shared setting applies to the other");
  assert.equal(home.homepage, "https://roomwise.acme.workers.dev");
  assert.equal(spawnSync("unzip", ["-p", `${cwd}dist/plugins/roomwise-1.0.0.zip`, "mcp.json"], { encoding: "utf8" }).stdout.includes("https://roomwise.acme.workers.dev/mcp"), true);
});

test("refuses to build a ZIP with a placeholder publisher or no contact email", () => {
  const r = run({ ROOMWISE_URL: "https://roomwise.acme.workers.dev", AISLE_URL: "https://aisle.acme.workers.dev" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Publisher name or contact email is missing/);
});

test("copies finished ZIPs to Downloads (or PLUGIN_ZIP_DIR), never placeholder builds, and only if the folder exists", () => {
  const { mkdirSync, existsSync } = require_fs();
  const home = mkdtempSync(`${tmpdir()}/home-`);
  mkdirSync(`${home}/Downloads`);
  const real = { HOME: home, PUBLISHER_NAME: "Acme Ltd", CONTACT_EMAIL: "help@acme.dev", ROOMWISE_URL: "https://roomwise.acme.workers.dev", AISLE_URL: "https://aisle.acme.workers.dev" };
  const r = run(real);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(`${home}/Downloads/roomwise-1.0.0.zip`) && existsSync(`${home}/Downloads/aisle-seating-1.0.0.zip`));
  assert.match(r.stdout, /Copied to your Downloads folder/);
  // placeholder builds: nothing copied
  const home2 = mkdtempSync(`${tmpdir()}/home-`); mkdirSync(`${home2}/Downloads`);
  assert.equal(run({ HOME: home2 }, "--allow-placeholders").status, 0);
  assert.equal(existsSync(`${home2}/Downloads/roomwise-1.0.0.zip`), false, "placeholder ZIPs are never copied");
  // explicit opt-out and a custom folder
  const home3 = mkdtempSync(`${tmpdir()}/home-`); mkdirSync(`${home3}/Downloads`);
  run({ ...real, HOME: home3 }, "--no-copy");
  assert.equal(existsSync(`${home3}/Downloads/roomwise-1.0.0.zip`), false);
  const custom = mkdtempSync(`${tmpdir()}/zips-`);
  run({ ...real, HOME: home3, PLUGIN_ZIP_DIR: custom });
  assert.ok(existsSync(`${custom}/aisle-seating-1.0.0.zip`));
  // no Downloads folder: says so, still succeeds
  const bare = run({ ...real, HOME: mkdtempSync(`${tmpdir()}/home-`) });
  assert.equal(bare.status, 0);
  assert.match(bare.stdout, /not copied: .*Downloads does not exist/);
});

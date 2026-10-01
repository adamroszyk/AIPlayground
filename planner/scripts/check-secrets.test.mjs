import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "./check-secrets.mjs";

const fake = {
  cf: "cf" + "at_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0",
  r2: "0123456789abcdef".repeat(4),
  gh: "gh" + "p_" + "A".repeat(36),
  sk: "sk" + "-" + "A1b2C3d4E5f6G7h8I9j0K1",
  pem: "-----BEGIN " + "RSA PRIVATE KEY-----",
};
test("flags real-looking credentials", () => {
  for (const [k, v] of Object.entries(fake)) assert.ok(scanText("x", `value: ${v}`).length > 0, k);
  assert.ok(scanText("x", `curl -H "Authorization: Bearer ${fake.cf}"`).length > 0);
  assert.ok(scanText("x", `CLOUDFLARE_API_TOKEN=${fake.cf}`).length > 0);
});
test("does not flag the placeholders and variable names used in the docs and scripts", () => {
  for (const ok of ["export CLOUDFLARE_API_TOKEN=<your token>", "CLOUDFLARE_API_TOKEN is not set", "process.env.CLOUDFLARE_API_TOKEN", 'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}', "authorization: `Bearer ${token}`", "const id = 048ff2c67aff7f285894f73f3abcc6d0", "OPENAI_APPS_CHALLENGE_ROOMWISE=<token>"]) assert.deepEqual(scanText("x", ok), [], ok);
});

// End to end in a throwaway git repo, run from a subdirectory (the case that broke the first version).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));
function repo() {
  const d = mkdtempSync(`${tmpdir()}/secrets-`);
  const git = (...a) => execFileSync("git", ["-C", d, ...a], { stdio: "pipe" });
  git("init", "-q"); git("config", "user.email", "t@t.t"); git("config", "user.name", "t");
  mkdirSync(`${d}/sub/deep`, { recursive: true });
  return { d, git, run: (cwd, ...args) => spawnSync("node", [script, ...args], { cwd, encoding: "utf8" }) };
}
test("end to end: a planted token is caught in untracked, tracked and staged files, from any directory", () => {
  const { d, git, run } = repo();
  writeFileSync(`${d}/sub/deep/ok.txt`, "nothing here\n");
  assert.equal(run(`${d}/sub`).status, 0);
  assert.match(run(`${d}/sub`).stdout, /1 files scanned/);
  writeFileSync(`${d}/sub/deep/notes.md`, `token: ${fake.cf}\n`);
  const r = run(`${d}/sub/deep`);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /sub\/deep\/notes\.md:1\s+Cloudflare API token/);
  assert.ok(!r.stderr.includes(fake.cf), "the report never prints the secret itself");
  git("add", "-A");
  assert.equal(run(d, "--staged").status, 1, "staged mode catches it");
  writeFileSync(`${d}/sub/deep/notes.md`, "clean now\n");
  git("add", "-A");
  assert.equal(run(d, "--staged").status, 0, "and passes once removed");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileBackend, forgetCredentials, keychainBackend, loadCredentials, pickBackend, saveCredentials, secretToolBackend, verifyToken } from "./credentials.mjs";

const TOKEN = "cf" + "at_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0";
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const tmp = () => mkdtempSync(path.join(tmpdir(), "creds-"));

test("file backend: round trip, private permissions, and the token is not in the config file", () => {
  const dir = tmp(), backend = fileBackend(dir);
  saveCredentials({ token: TOKEN, accountId: ACCOUNT, backend, dir });
  assert.deepEqual({ ...loadCredentials({ backend, dir }), savedAt: undefined, backend: undefined }, { token: TOKEN, accountId: ACCOUNT, savedAt: undefined, backend: undefined });
  assert.equal(statSync(path.join(dir, "cloudflare-token")).mode & 0o777, 0o600);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.ok(!readFileSync(path.join(dir, "cloudflare.json"), "utf8").includes(TOKEN), "config file holds the account id only");
  forgetCredentials({ backend, dir });
  assert.equal(loadCredentials({ backend, dir }), null);
  assert.deepEqual(readdirSync(dir), []);
});

test("keychain backend: token goes to `security -i` on stdin and never into the argument list", () => {
  const calls = [];
  const run = (cmd, args, opt) => { calls.push({ cmd, args, input: opt?.input }); return { status: 0, stdout: `${TOKEN}\n`, stderr: "" }; };
  const kc = keychainBackend(run);
  kc.save(TOKEN, ACCOUNT);
  assert.equal(calls[0].cmd, "security");
  assert.deepEqual(calls[0].args, ["-i"]);
  assert.match(calls[0].input, /^add-generic-password -U -a 0123456789abcdef0123456789abcdef -s planner-cloudflare -w cfat_/);
  assert.ok(!calls.some((c) => c.args.join(" ").includes(TOKEN)), "token never appears in argv");
  assert.equal(kc.load(), TOKEN);
  assert.deepEqual(calls[1].args, ["find-generic-password", "-s", "planner-cloudflare", "-w"]);
  assert.throws(() => kc.save("bad value; rm -rf /", ACCOUNT), /unexpected characters/);
  assert.throws(() => keychainBackend(() => ({ status: 1, stderr: "denied" })).save(TOKEN, ACCOUNT), /Keychain refused.*denied/);
  assert.equal(keychainBackend(() => ({ status: 44, stdout: "" })).load(), null, "not found is null, not an error");
});

test("libsecret backend passes the token on stdin", () => {
  const calls = [];
  secretToolBackend((cmd, args, opt) => { calls.push({ cmd, args, input: opt?.input }); return { status: 0 }; }).save(TOKEN);
  assert.equal(calls[0].input, TOKEN);
  assert.ok(!calls[0].args.join(" ").includes(TOKEN));
});

test("backend choice: Keychain on macOS, libsecret on Linux when present, else a private file", () => {
  const dir = tmp();
  assert.equal(pickBackend({ platform: "darwin", dir }).name, "macOS Keychain");
  assert.match(pickBackend({ platform: "linux", run: () => ({ status: 0 }), dir }).name, /libsecret/);
  assert.match(pickBackend({ platform: "linux", run: () => ({ status: 1 }), dir }).name, /private file/);
  assert.match(pickBackend({ platform: "win32", dir }).name, /private file/);
});

test("verifyToken reads status and expiry, tries the user endpoint, and separates 'invalid' from 'offline'", async () => {
  const f = (map) => async (url) => { const hit = Object.entries(map).find(([k]) => url.endsWith(k)); if (!hit) throw new Error("offline"); return { json: async () => hit[1] }; };
  assert.deepEqual(await verifyToken({ token: TOKEN, accountId: ACCOUNT, fetchImpl: f({ [`/accounts/${ACCOUNT}/tokens/verify`]: { success: true, result: { status: "active", expires_on: "2026-10-08T00:00:00Z" } } }) }), { ok: true, expiresOn: "2026-10-08T00:00:00Z" });
  assert.equal((await verifyToken({ token: TOKEN, accountId: ACCOUNT, fetchImpl: f({ "/user/tokens/verify": { success: true, result: { status: "active" } } }) })).ok, true, "user-owned tokens work too");
  const bad = await verifyToken({ token: TOKEN, accountId: ACCOUNT, fetchImpl: f({ [`/accounts/${ACCOUNT}/tokens/verify`]: { success: false }, "/user/tokens/verify": { success: false } }) });
  assert.equal(bad.ok, false); assert.ok(!bad.unreachable);
  const proxy = await verifyToken({ token: TOKEN, accountId: ACCOUNT, fetchImpl: async () => ({ json: async () => { throw new Error("not json"); } }) });
  assert.equal(proxy.unreachable, true, "a non-JSON answer is 'could not check', not 'token rejected'");
  const off = await verifyToken({ token: TOKEN, accountId: ACCOUNT, fetchImpl: async () => { throw new Error("x"); } });
  assert.equal(off.unreachable, true);
});

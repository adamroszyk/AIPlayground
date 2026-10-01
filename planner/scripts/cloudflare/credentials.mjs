// Saves the Cloudflare API token and account ID outside the repository, so deploys do not need them typed each time.
// The token goes in the operating system's secret store when there is one (macOS Keychain, Linux libsecret);
// only if there is none does it fall back to a file readable by you alone. The account ID is not secret and lives in a small JSON file.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const SERVICE = "planner-cloudflare";
const API = "https://api.cloudflare.com/client/v4";
export const configDir = (home = os.homedir()) => path.join(home, ".config", "planner");
const SAFE = /^[A-Za-z0-9_-]+$/; // the only characters that may reach a command line or the keychain script

/** macOS Keychain. The token is sent on stdin to `security -i`, never as a command-line argument (which other processes can read). */
export function keychainBackend(run = spawnSync) {
  return {
    name: "macOS Keychain",
    save(token, account) {
      if (!SAFE.test(token) || !SAFE.test(account)) throw new Error("Refusing to store a value with unexpected characters.");
      const r = run("security", ["-i"], { input: `add-generic-password -U -a ${account} -s ${SERVICE} -w ${token}\n`, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`The macOS Keychain refused to save it: ${(r.stderr || r.stdout || "unknown error").trim()}`);
    },
    load() { const r = run("security", ["find-generic-password", "-s", SERVICE, "-w"], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() || null : null; },
    remove() { run("security", ["delete-generic-password", "-s", SERVICE], { encoding: "utf8" }); },
  };
}

/** Linux libsecret via `secret-tool` (GNOME Keyring, KWallet). Secret on stdin. */
export function secretToolBackend(run = spawnSync) {
  return {
    name: "the system keyring (libsecret)",
    save(token) { const r = run("secret-tool", ["store", "--label=Cloudflare token for the planner scripts", "service", SERVICE], { input: token, encoding: "utf8" }); if (r.status !== 0) throw new Error(`secret-tool failed: ${(r.stderr || "").trim()}`); },
    load() { const r = run("secret-tool", ["lookup", "service", SERVICE], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() || null : null; },
    remove() { run("secret-tool", ["clear", "service", SERVICE], { encoding: "utf8" }); },
  };
}

/** Last resort: a file only you can read (mode 600) inside a private (700) folder, outside the repository. */
export function fileBackend(dir = configDir()) {
  const file = path.join(dir, "cloudflare-token");
  return {
    name: `a private file (${file})`,
    save(token) { mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700); writeFileSync(file, token + "\n", { mode: 0o600 }); chmodSync(file, 0o600); },
    load() { return existsSync(file) ? readFileSync(file, "utf8").trim() || null : null; },
    remove() { rmSync(file, { force: true }); },
  };
}

export function pickBackend({ platform = process.platform, run = spawnSync, dir = configDir() } = {}) {
  if (platform === "darwin") return keychainBackend(run);
  if (platform === "linux" && run("secret-tool", ["--version"], { encoding: "utf8" }).status === 0) return secretToolBackend(run);
  return fileBackend(dir);
}

const configFile = (dir) => path.join(dir, "cloudflare.json");

export function saveCredentials({ token, accountId, backend = pickBackend(), dir = configDir() }) {
  backend.save(token, accountId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(configFile(dir), JSON.stringify({ accountId, backend: backend.name, savedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
  return backend.name;
}
export function loadCredentials({ backend = pickBackend(), dir = configDir() } = {}) {
  if (!existsSync(configFile(dir))) return null;
  let cfg; try { cfg = JSON.parse(readFileSync(configFile(dir), "utf8")); } catch { return null; }
  const token = backend.load();
  return token && cfg.accountId ? { token, accountId: cfg.accountId, backend: backend.name, savedAt: cfg.savedAt } : null;
}
export function forgetCredentials({ backend = pickBackend(), dir = configDir() } = {}) { backend.remove(); rmSync(configFile(dir), { force: true }); }

/** Asks Cloudflare whether the token is active, and when it expires. Account-owned tokens verify under the account; user-owned under /user. */
export async function verifyToken({ token, accountId, fetchImpl = fetch }) {
  let sawNetworkError = false;
  for (const p of [`/accounts/${accountId}/tokens/verify`, "/user/tokens/verify"]) {
    try {
      const res = await fetchImpl(`${API}${p}`, { headers: { authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (body === null) { sawNetworkError = true; continue; } // an HTML or plain-text answer (proxy, captive portal) says nothing about the token
      if (body.success && body.result?.status === "active") return { ok: true, expiresOn: body.result.expires_on ?? null };
      if (body.success && body.result?.status) return { ok: false, reason: `the token is ${body.result.status}` };
    } catch { sawNetworkError = true; }
  }
  return sawNetworkError ? { ok: false, unreachable: true, reason: "could not reach Cloudflare" } : { ok: false, reason: "Cloudflare does not accept this token (wrong, revoked or expired)" };
}

/** A copy of the environment with the saved Cloudflare credentials filled in, when none are set. */
export function envWithSavedCredentials(env = process.env, load = loadCredentials) {
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) return { ...env };
  const c = load();
  return c ? { ...env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN ?? c.token, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? c.accountId } : { ...env };
}

// Publisher name and contact email: not secret, but they must be identical in every ZIP and on the legal pages, so remember them.
const profileFile = (dir) => path.join(dir, "profile.json");
export function saveProfile({ publisher, email }, dir = configDir()) { mkdirSync(dir, { recursive: true, mode: 0o700 }); writeFileSync(profileFile(dir), JSON.stringify({ publisher, email }, null, 2) + "\n", { mode: 0o600 }); }
export function loadProfile(dir = configDir()) { try { const p = JSON.parse(readFileSync(profileFile(dir), "utf8")); return p.publisher && p.email ? p : null; } catch { return null; } }

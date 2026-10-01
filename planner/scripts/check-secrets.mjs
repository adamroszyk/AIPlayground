// Refuses to pass if anything that looks like a credential is in a file git would commit.
//   node scripts/check-secrets.mjs            scans tracked and untracked-but-not-ignored files
//   node scripts/check-secrets.mjs --staged   scans what is staged (used by the pre-commit hook)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Built from pieces so this file does not trip its own scanner.
export const PATTERNS = [
  ["Cloudflare API token", new RegExp("\\bcf" + "[a-z]t_[A-Za-z0-9]{20,}")],
  ["Cloudflare R2 secret access key (64 hex)", /\b[0-9a-f]{64}\b/],
  ["Bearer token", /Bearer\s+(?!<)[A-Za-z0-9._~+/-]{24,}/],
  ["Token assigned to an environment variable", /\b(?:CLOUDFLARE_API_TOKEN|OPENAI_APPS_CHALLENGE\w*|API_TOKEN|SECRET_ACCESS_KEY)\s*[:=]\s*["']?(?![<$"'\s]|your|xxx|\.\.\.)(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{24,}/i],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["OpenAI-style secret key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
];
const SKIP = /(^|\/)(package-lock\.json|node_modules\/)|\.(png|jpe?g|webp|gif|ico|mp4|webm|zip|pdf|woff2?)$/i;

export function scanText(path, text) {
  const found = [];
  text.split("\n").forEach((line, i) => { for (const [name, re] of PATTERNS) if (re.test(line)) found.push({ path, line: i + 1, name }); });
  return found;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-secrets.mjs")) {
  const staged = process.argv.includes("--staged");
  const run = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
  const root = run(process.cwd(), "rev-parse", "--show-toplevel").trim();
  const git = (...a) => run(root, ...a);
  // Paths are always relative to the repository root, whatever directory this is run from.
  const files = (staged ? git("diff", "--cached", "--name-only", "--diff-filter=ACM", "-z") : git("ls-files", "-co", "--exclude-standard", "-z")).split("\0").filter(Boolean);
  const hits = [], unreadable = [];
  let scanned = 0;
  for (const f of files) {
    if (SKIP.test(f)) continue;
    let text;
    try { text = staged ? git("show", `:${f}`) : readFileSync(`${root}/${f}`, "utf8"); } catch { if (!staged && !existsSync(`${root}/${f}`)) continue; unreadable.push(f); continue; }
    if (text.includes("\0")) continue;
    scanned++;
    hits.push(...scanText(f, text));
  }
  if (unreadable.length) { console.error(`check-secrets could not read ${unreadable.length} file(s), so it cannot vouch for them:\n  ${unreadable.slice(0, 10).join("\n  ")}`); process.exit(2); }
  if (files.length > 0 && scanned === 0) { console.error("check-secrets scanned no files. Refusing to report success."); process.exit(2); }
  if (hits.length) {
    console.error("Possible secrets found. Nothing was committed:\n" + hits.map((h) => `  ${h.path}:${h.line}  ${h.name}`).join("\n") + "\n\nRemove the value (never paste credentials into files). If it is a false positive, tell Claude or edit scripts/check-secrets.mjs.");
    process.exit(1);
  }
  console.log(`check-secrets: ${scanned} files scanned, nothing suspicious.`);
}

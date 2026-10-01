// Stores the OpenAI domain-verification token on a deployed Worker and checks the route serves it back.
//   npm run set-challenge -- home|wedding
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ask } from "./cloudflare/prompt.mjs";
import { loadCredentials } from "./cloudflare/credentials.mjs";
import { resolveSiteUrl } from "./cloudflare/cf.mjs";

const app = process.argv[2];
const P = { home: { name: "roomwise", env: "ROOMWISE_URL" }, wedding: { name: "aisle", env: "AISLE_URL" } }[app];
if (!P) { console.error("usage: npm run set-challenge -- home|wedding"); process.exit(2); }

const env = { ...process.env };
if (!env.CLOUDFLARE_API_TOKEN) { const c = loadCredentials(); if (c) { env.CLOUDFLARE_API_TOKEN = c.token; env.CLOUDFLARE_ACCOUNT_ID = c.accountId; } }
if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) { console.error("No Cloudflare credentials found. Run: npm run credentials"); process.exit(1); }

const url = await resolveSiteUrl({ envName: P.env, workerName: P.name, env });
const token = await ask(`Paste the verification token OpenAI shows for ${url} (typing is hidden): `, { hidden: true });
if (!/^\S{8,}$/.test(token)) { console.error("That does not look like a token (it must have no spaces)."); process.exit(1); }

const dir = fileURLToPath(new URL(`../apps/${app}/`, import.meta.url));
const r = spawnSync("npx", ["wrangler", "secret", "put", "OPENAI_APPS_CHALLENGE", "-c", "wrangler.deploy.json"], { cwd: dir, input: token, env, stdio: ["pipe", "inherit", "inherit"], encoding: "utf8" });
if (r.status !== 0) { console.error("\nwrangler could not store the secret. If wrangler.deploy.json is missing, run 'npm run deploy' first."); process.exit(1); }

console.log(`\nChecking ${url}/.well-known/openai-apps-challenge ...`);
for (let i = 0; i < 12; i++) {
  try {
    const res = await fetch(`${url}/.well-known/openai-apps-challenge`);
    if (res.status === 200 && (await res.text()) === token) { console.log("The route returns exactly the token. Go back to the OpenAI page and click Verify."); process.exit(0); }
  } catch { /* retry */ }
  await new Promise((r2) => setTimeout(r2, 5000));
}
console.error("The route does not return the token yet. Wait a minute and run: node scripts/smoke.mjs " + url + " " + app + " --challenge=<token>");
process.exit(1);

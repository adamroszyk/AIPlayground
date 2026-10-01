// Deploys one product to Cloudflare Workers, applies D1 migrations, sets the OpenAI challenge secret, and smoke-tests it.
//   node scripts/deploy.mjs <home|wedding> [--dry-run] [--skip-smoke]
// Environment (see docs/plan/go-live.md):
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   wrangler credentials (never put these in a file)
//   ROOMWISE_URL / AISLE_URL                      https://<hostname> for the product being deployed
//   PUBLISHER_NAME, CONTACT_EMAIL                 shown on the legal pages; must match your OpenAI publisher identity
//   OPENAI_APPS_CHALLENGE_ROOMWISE / _AISLE       token from the OpenAI dashboard (optional on the first deploy)
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const [app, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry-run"), skipSmoke = flags.includes("--skip-smoke");
const P = { home: { url: "ROOMWISE_URL", token: "OPENAI_APPS_CHALLENGE_ROOMWISE", pkg: "@planner/home" }, wedding: { url: "AISLE_URL", token: "OPENAI_APPS_CHALLENGE_AISLE", pkg: "@planner/wedding" } }[app];
if (!P) { console.error("usage: node scripts/deploy.mjs <home|wedding> [--dry-run] [--skip-smoke]"); process.exit(2); }

const problems = [];
const siteUrl = (process.env[P.url] ?? "").replace(/\/$/, "");
let host = "";
try { const u = new URL(siteUrl); host = u.hostname; if (u.protocol !== "https:" || u.pathname !== "/" || u.search) problems.push(`${P.url} must be a bare https origin such as https://${host}`); if (/example\.(com|org|net)$/.test(host)) problems.push(`${P.url} still uses a placeholder host`); } catch { problems.push(`${P.url} is not set (an https origin such as https://planner.yourdomain.com)`); }
if (!process.env.PUBLISHER_NAME) problems.push("PUBLISHER_NAME is not set; the legal pages would say [Publisher name]");
if (!process.env.CONTACT_EMAIL) problems.push("CONTACT_EMAIL is not set; the support and privacy pages need a real address");
if (!dry && !process.env.CLOUDFLARE_API_TOKEN) problems.push("CLOUDFLARE_API_TOKEN is not set");
if (problems.length && !dry) { console.error("Cannot deploy:\n - " + problems.join("\n - ")); process.exit(1); }
if (problems.length) console.warn("Dry run, ignoring:\n - " + problems.join("\n - ") + "\n");

const dir = new URL(`../apps/${app}/`, import.meta.url).pathname;
const sh = (cmd, args, opt = {}) => {
  console.log(`\n$ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: opt.input ? ["pipe", "inherit", "inherit"] : "inherit", encoding: "utf8", cwd: opt.cwd ?? dir, input: opt.input, env: { ...process.env, ...opt.env } });
  if (r.status !== 0) { console.error(`\nFailed: ${cmd} ${args.join(" ")} (exit ${r.status})`); process.exit(r.status ?? 1); }
};

// 1. build with the real hostname and publisher name baked into canonical URLs and legal pages
sh("npm", ["run", "build", "-w", P.pkg], { cwd: new URL("..", import.meta.url).pathname, env: { SITE_URL: siteUrl || "https://placeholder.example.com", PUBLISHER_NAME: process.env.PUBLISHER_NAME ?? "", CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? "" } });

// 2. deploy config = the committed config + this hostname. Binding ids are left out: wrangler provisions KV and D1 on first deploy.
const base = JSON.parse(await readFile(`${dir}wrangler.jsonc`, "utf8"));
// A free <worker>.<your-subdomain>.workers.dev hostname needs no route. Anything else is attached as a custom domain (needs an active zone).
const onWorkersDev = host.endsWith(".workers.dev");
if (onWorkersDev && host.split(".")[0] !== base.name) { console.error(`On workers.dev the hostname must start with the Worker name "${base.name}" (got ${host}). Use https://${base.name}.<your-workers-subdomain>.workers.dev`); process.exit(1); }
const config = {
  ...base,
  ...(onWorkersDev ? { workers_dev: true, routes: [] } : { routes: host ? [{ pattern: host, custom_domain: true }] : [] }),
  vars: { ...(base.vars ?? {}), PUBLIC_BASE_URL: siteUrl },
  limits: { cpu_ms: 10000 }, // the solver is CPU-heavy; this needs the Workers Paid plan (free plan allows 10 ms)
  observability: { enabled: true },
};
await writeFile(`${dir}wrangler.deploy.json`, JSON.stringify(config, null, 2) + "\n");
console.log(`\nDeploy config for ${base.name}:\n${JSON.stringify({ routes: config.routes, vars: config.vars, limits: config.limits }, null, 2)}`);

// 3. deploy
sh("npx", ["wrangler", "deploy", "-c", "wrangler.deploy.json", ...(dry ? ["--dry-run", "--outdir", `/tmp/deploy-${app}`] : [])]);
if (dry) { console.log("\nDry run complete: nothing was uploaded."); process.exit(0); }

// 4. D1 schema, then the secret, then prove it works
sh("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--remote", "-c", "wrangler.deploy.json"], { input: "y\n" });
const token = process.env[P.token];
if (token) sh("npx", ["wrangler", "secret", "put", "OPENAI_APPS_CHALLENGE", "-c", "wrangler.deploy.json"], { input: token });
else console.log(`\n${P.token} not set: /.well-known/openai-apps-challenge stays 404 until you add it (OpenAI shows the token after you start the domain verification).`);
if (!skipSmoke) sh("node", ["scripts/smoke.mjs", siteUrl, app, ...(token ? [`--challenge=${token}`] : [])], { cwd: new URL("..", import.meta.url).pathname });
console.log(`\nDeployed ${base.name} to ${siteUrl}`);

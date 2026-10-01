// One command for the whole first deploy: asks for anything missing, deploys both products, builds the plugin ZIPs.
//   node scripts/deploy-all.mjs            (add --dry-run to rehearse without uploading)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ask, looksLikeAccountId, looksLikeToken } from "./cloudflare/prompt.mjs";

const flags = process.argv.slice(2);
const env = { ...process.env };
const dry = flags.includes("--dry-run");

async function need(name, question, { hidden = false, valid, hint }) {
  if (env[name]) { if (valid && !valid(env[name])) { console.error(`${name} is set but ${hint}`); process.exit(1); } return; }
  for (let tries = 0; tries < 3; tries++) {
    const v = await ask(question, { hidden });
    if (v && (!valid || valid(v))) { env[name] = v; return; }
    console.log(valid && v ? `That ${hint}` : "Please enter a value.");
  }
  console.error("Giving up after 3 tries."); process.exit(1);
}

try {
  if (!dry) {
    await need("CLOUDFLARE_API_TOKEN", "Cloudflare API token (typing is hidden): ", { hidden: true, valid: looksLikeToken, hint: "does not look like an API token. Create one from the 'Edit Cloudflare Workers' template and paste the real value, not a placeholder." });
    await need("CLOUDFLARE_ACCOUNT_ID", "Cloudflare account ID (32 letters and digits): ", { valid: looksLikeAccountId, hint: "is not a 32-character account ID. It is in the dashboard address: dash.cloudflare.com/<account id>/..." });
  } else {
    env.CLOUDFLARE_API_TOKEN ??= "dry-run"; env.CLOUDFLARE_ACCOUNT_ID ??= "dry-run";
  }
  await need("PUBLISHER_NAME", "Publisher name (must match your OpenAI verified identity): ", {});
  await need("CONTACT_EMAIL", "Public contact email: ", { valid: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), hint: "does not look like an email address." });
} catch (e) { console.error(e.message); process.exit(1); }

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const run = (script, args) => { const r = spawnSync(process.execPath, [here(script), ...args], { stdio: "inherit", env, cwd: here("..") }); if (r.status !== 0) { console.error(`\nStopped: ${script} ${args.join(" ")} failed (exit ${r.status}). Nothing after it was run.`); process.exit(r.status ?? 1); } };

run("./deploy.mjs", ["home", ...flags]);
run("./deploy.mjs", ["wedding", ...flags]);
run("./package-plugins.ts", []);
console.log(`\nDone${dry ? " (dry run: nothing was uploaded)" : ""}. The plugin ZIPs are in ${here("../dist/plugins/")}`);

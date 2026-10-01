// Builds each plugin package (directory + ZIP), lints the ZIP itself, and fails on any error.
// Usage: node scripts/package-plugins.ts [--release]
//   PUBLISHER_NAME, CONTACT_EMAIL, ROOMWISE_URL, AISLE_URL, DEMO_URL_ROOMWISE, DEMO_URL_AISLE (see docs/plan/go-live.md)
import { fileURLToPath } from "node:url";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { buildPluginFiles, lintPlugin, readZip, writeZip, type PluginSpec } from "@planner/plugin-kit";
// @ts-ignore plain JS helper
import { resolveSiteUrl } from "./cloudflare/cf.mjs";
// @ts-ignore plain JS helper
import { envWithSavedCredentials, loadProfile } from "./cloudflare/credentials.mjs";

const release = process.argv.includes("--release");
const allowPlaceholders = process.argv.includes("--allow-placeholders");
const env = envWithSavedCredentials();
const profile = loadProfile();
const publisher = process.env.PUBLISHER_NAME ?? profile?.publisher ?? "[Publisher name]";
const email = process.env.CONTACT_EMAIL ?? profile?.email ?? "";
if ((publisher === "[Publisher name]" || !email) && !allowPlaceholders) {
  console.error("Publisher name or contact email is missing, so the ZIP would show a placeholder.\nSet PUBLISHER_NAME and CONTACT_EMAIL (or run 'npm run deploy' once, which remembers them) and try again.");
  process.exit(1);
}
const lookup = async (envName: string, workerName: string) => {
  const url = await resolveSiteUrl({ envName, workerName, env });
  if (url) return url;
  if (allowPlaceholders) return `https://${workerName}.example.com`;
  console.error(`Cannot tell where ${workerName} is deployed, and a ZIP with a placeholder address must never be uploaded (the MCP URL cannot be changed later).\nRun 'npm run credentials' once, or set ${envName}=https://<host> and try again.`);
  process.exit(1);
};
const products = [
  { dir: "home", url: await lookup("ROOMWISE_URL", "roomwise"), demo: process.env.DEMO_URL_ROOMWISE, category: process.env.PLUGIN_CATEGORY_ROOMWISE ?? process.env.PLUGIN_CATEGORY },
  { dir: "wedding", url: await lookup("AISLE_URL", "aisle"), demo: process.env.DEMO_URL_AISLE, category: process.env.PLUGIN_CATEGORY_AISLE ?? process.env.PLUGIN_CATEGORY },
];
const out = fileURLToPath(new URL("../dist/plugins/", import.meta.url));
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

let failed = false;
for (const p of products) {
  const app = fileURLToPath(new URL(`../apps/${p.dir}/`, import.meta.url));
  const { spec } = (await import(`${app}plugin/spec.ts`)) as { spec: PluginSpec };
  const shotDir = `${app}plugin/assets`;
  const shots = await Promise.all((await readdir(shotDir).catch(() => [] as string[])).filter((f) => /^screenshot-\d+\.png$/.test(f)).sort().map((f) => readFile(`${shotDir}/${f}`)));
  const snapshot = JSON.parse(await readFile(`${app}plugin/tools.snapshot.json`, "utf8")) as { name: string }[];
  const files = buildPluginFiles(p.category ? { ...spec, category: p.category } : spec, { publisher, email, siteUrl: p.url, demoUrl: p.demo, screenshots: shots });
  const zip = writeZip(files);
  const zipPath = `${out}${spec.name}-${spec.version}.zip`;
  await writeFile(zipPath, zip);
  // Lint what is actually in the ZIP, not the in-memory files.
  const { errors, warnings } = lintPlugin(readZip(zip), { release, toolNames: snapshot.map((t) => t.name) });
  for (const [path, data] of files) { await mkdir(`${out}${spec.name}/${path.split("/").slice(0, -1).join("/")}`, { recursive: true }); await writeFile(`${out}${spec.name}/${path}`, data); }
  console.log(`\n${spec.displayName}: ${zipPath.replace(process.cwd() + "/", "")} (${files.size} files, ${(zip.length / 1024).toFixed(0)} KB)`);
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors) console.log(`  ERROR: ${e}`);
  if (errors.length === 0) console.log(`  lint: ok${release ? " (release mode)" : " (dev mode: placeholders are warnings)"}`);
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);

// Builds each plugin package (directory + ZIP), lints the ZIP itself, and fails on any error.
// Usage: node scripts/package-plugins.ts [--release]
//   PUBLISHER_NAME, CONTACT_EMAIL, ROOMWISE_URL, AISLE_URL, DEMO_URL_ROOMWISE, DEMO_URL_AISLE (see docs/plan/go-live.md)
import { fileURLToPath } from "node:url";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { buildPluginFiles, lintPlugin, readZip, writeZip, type PluginSpec } from "@planner/plugin-kit";
// @ts-ignore plain JS helper
import { resolveSiteUrl } from "./cloudflare/cf.mjs";

const release = process.argv.includes("--release");
const publisher = process.env.PUBLISHER_NAME ?? "[Publisher name]";
const email = process.env.CONTACT_EMAIL ?? "";
const products = [
  { dir: "home", url: (await resolveSiteUrl({ envName: "ROOMWISE_URL", workerName: "roomwise" })) ?? "https://roomwise.example.com", demo: process.env.DEMO_URL_ROOMWISE },
  { dir: "wedding", url: (await resolveSiteUrl({ envName: "AISLE_URL", workerName: "aisle" })) ?? "https://aisle.example.com", demo: process.env.DEMO_URL_AISLE },
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
  const files = buildPluginFiles(spec, { publisher, email, siteUrl: p.url, demoUrl: p.demo, screenshots: shots });
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

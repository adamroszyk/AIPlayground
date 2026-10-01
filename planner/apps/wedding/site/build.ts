import { fileURLToPath } from "node:url";
import { buildEditor, buildSite, envFromProcess, renderDemo } from "@planner/core";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { EDITOR_CSS, WEDDING_EDITOR_CSS } from "@planner/editor-kit";
import { SEATING_CSS } from "@planner/engine";
import { wedding } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://aisle.example.com" });
const out = fileURLToPath(new URL("../dist/site", import.meta.url));
const urls = await buildSite(wedding, env, out);
await buildEditor(wedding, env, out, { entry: fileURLToPath(new URL("../editor/main.ts", import.meta.url)), title: "Seating chart planner | Aisle", description: "Build a wedding seating chart that follows your rules.", editorCss: EDITOR_CSS + SEATING_CSS + WEDDING_EDITOR_CSS, noscript: "The planner needs JavaScript. Everything runs in your browser." });
// Demo walkthrough hosted on this site: any .mp4 in site/demo/ is published at /demo/ (static assets are free and need no sign-in).
const demoDir = fileURLToPath(new URL("./demo/", import.meta.url));
for (const f of (await readdir(demoDir).catch(() => [] as string[])).filter((x) => x.endsWith(".mp4"))) {
  await mkdir(`${out}/demo`, { recursive: true });
  await copyFile(`${demoDir}${f}`, `${out}/demo/${f}`);
  await writeFile(`${out}/demo/index.html`, renderDemo(wedding, env, { videoFile: f, segments: ["A user asks to seat 16 guests with rules; the model calls plan_wedding_seating and the server returns a checked chart", "The widget shows the chart and each rule as met or not", "The same chart in the web editor: swapping guests breaks a rule, a full table refuses another guest, and Plan seating restores a valid chart", "Contradictory rules produce a conflict explanation; the day-of timeline warns about a venue curfew", "Saving gives a private edit link and a read-only share link; delete removes the chart at once; what Aisle does not do"] }));
}
console.log(`Built ${urls.length} pages for aisle → apps/wedding/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

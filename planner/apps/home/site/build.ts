import { fileURLToPath } from "node:url";
import { buildEditor, buildSite, envFromProcess, renderDemo } from "@planner/core";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { EDITOR_CSS } from "@planner/editor-kit";
import { PLAN_CSS } from "@planner/engine";
import { home } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://roomwise.example.com" });
const out = fileURLToPath(new URL("../dist/site", import.meta.url));
const urls = await buildSite(home, env, out);
await buildEditor(home, env, out, { entry: fileURLToPath(new URL("../editor/main.ts", import.meta.url)), title: "Room layout planner | Roomwise", description: "Plan a room layout to scale and check clearances.", editorCss: EDITOR_CSS + PLAN_CSS, noscript: "The planner needs JavaScript. Everything runs in your browser." });
// Demo walkthrough hosted on this site: any .mp4 in site/demo/ is published at /demo/ (static assets are free and need no sign-in).
const demoDir = fileURLToPath(new URL("./demo/", import.meta.url));
for (const f of (await readdir(demoDir).catch(() => [] as string[])).filter((x) => x.endsWith(".mp4"))) {
  await mkdir(`${out}/demo`, { recursive: true });
  await copyFile(`${demoDir}${f}`, `${out}/demo/${f}`);
  await writeFile(`${out}/demo/index.html`, renderDemo(home, env, { videoFile: f, segments: ["A user asks for a 14 by 12 ft living-room layout; the model calls plan_room_layout and the server returns a checked, to-scale plan", "The widget shows the plan with each check passed or failed and its measured value", "The same plan in the web editor: dragging the armchair into the doorway makes the checks fail, naming the rule", "Plan layout re-solves it; the materials panel estimates flooring, paint and baseboard", "Saving gives a private edit link and a read-only share link; delete removes the plan at once; what Roomwise does not do"] }));
}
console.log(`Built ${urls.length} pages for roomwise → apps/home/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

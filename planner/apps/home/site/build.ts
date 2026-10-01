import { buildEditor, buildSite, envFromProcess } from "@planner/core";
import { EDITOR_CSS } from "@planner/editor-kit";
import { PLAN_CSS } from "@planner/engine";
import { home } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://roomwise.example.com" });
const out = new URL("../dist/site", import.meta.url).pathname;
const urls = await buildSite(home, env, out);
await buildEditor(home, env, out, { entry: new URL("../editor/main.ts", import.meta.url).pathname, title: "Room layout planner | Roomwise", description: "Plan a room layout to scale and check clearances.", editorCss: EDITOR_CSS + PLAN_CSS, noscript: "The planner needs JavaScript. Everything runs in your browser." });
console.log(`Built ${urls.length} pages for roomwise → apps/home/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

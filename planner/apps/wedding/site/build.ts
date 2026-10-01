import { fileURLToPath } from "node:url";
import { buildEditor, buildSite, envFromProcess } from "@planner/core";
import { EDITOR_CSS, WEDDING_EDITOR_CSS } from "@planner/editor-kit";
import { SEATING_CSS } from "@planner/engine";
import { wedding } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://aisle.example.com" });
const out = fileURLToPath(new URL("../dist/site", import.meta.url));
const urls = await buildSite(wedding, env, out);
await buildEditor(wedding, env, out, { entry: fileURLToPath(new URL("../editor/main.ts", import.meta.url)), title: "Seating chart planner | Aisle", description: "Build a wedding seating chart that follows your rules.", editorCss: EDITOR_CSS + SEATING_CSS + WEDDING_EDITOR_CSS, noscript: "The planner needs JavaScript. Everything runs in your browser." });
console.log(`Built ${urls.length} pages for aisle → apps/wedding/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

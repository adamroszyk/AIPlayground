import { buildSite, envFromProcess } from "@planner/core";
import { wedding } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://aisle.example.com" });
const urls = await buildSite(wedding, env, new URL("../dist/site", import.meta.url).pathname);
console.log(`Built ${urls.length} pages for aisle → apps/wedding/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

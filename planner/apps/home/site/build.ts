import { buildSite, envFromProcess } from "@planner/core";
import { home } from "./content.ts";

const env = envFromProcess({ siteUrl: "https://roomwise.example.com" });
const urls = await buildSite(home, env, new URL("../dist/site", import.meta.url).pathname);
console.log(`Built ${urls.length} pages for roomwise → apps/home/dist/site (SITE_URL=${env.siteUrl})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs use the placeholder");
if (!process.env.CONTACT_EMAIL) console.warn("WARN: CONTACT_EMAIL not set; legal pages show a placeholder");
if (!process.env.PUBLISHER_NAME) console.warn("WARN: PUBLISHER_NAME not set; must match your verified OpenAI publisher identity");

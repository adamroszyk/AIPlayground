import { build } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { TOOLS, bySlug, type ToolPage } from "./tools.ts";

const OUT = "dist/site";
const SITE_URL = (process.env.SITE_URL ?? "https://example.com").replace(/\/$/, "");
const MCP_URL = process.env.MCP_URL ?? ""; // empty = connector not deployed yet; pages say "coming soon"
const CONTACT = process.env.CONTACT_EMAIL ?? "";
const SITE_NAME = process.env.SITE_NAME ?? "Toolbox";
const UPDATED = new Date().toISOString().slice(0, 10);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

function layout(o: { title: string; description: string; path: string; body: string; ld?: unknown[]; current?: string; noindex?: boolean }) {
  const url = `${SITE_URL}${o.path}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234b3df2'/%3E%3Cpath d='M9 17l5 5 9-11' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/style.css">
${(o.ld ?? []).map(jsonLd).join("\n")}
</head><body>
<header class="site"><div class="wrap"><a class="brand" href="/">${esc(SITE_NAME)}</a><nav aria-label="Tools">
${TOOLS.map((t) => `<a href="/${t.slug}/"${o.current === t.slug ? ' aria-current="page"' : ""}>${esc(t.nav)}</a>`).join("")}
</nav></div></header>
<main class="wrap">${o.body}</main>
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(SITE_NAME)} · <a href="/connect/">Use in AI chat</a> · <a href="/privacy/">Privacy</a></div></footer>
</body></html>`;
}

function chatSection(t: ToolPage) {
  const prompts = `<ul>${t.chatPrompts.map((p) => `<li><q>${esc(p)}</q></li>`).join("")}</ul>`;
  const status = MCP_URL
    ? `<p>Add the connector to ChatGPT, Claude or any MCP-compatible assistant. See <a href="/connect/">how to connect</a>. Then ask:</p>`
    : `<p>An AI-chat connector for ChatGPT, Claude and Grok is in development, so an assistant can run this tool for you with exact results instead of guessing. <a href="/connect/">Details</a>. Once connected you will be able to ask:</p>`;
  return `<section class="chat" aria-labelledby="chat-h"><h2 id="chat-h" style="margin-top:0">Use it inside AI chat</h2>${status}${prompts}</section>`;
}

function toolPage(t: ToolPage) {
  const path = `/${t.slug}/`;
  const related = t.related.map(bySlug);
  const body = `
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<section class="tool" aria-label="${esc(t.h1)}"><div id="tool" data-tool="${t.widget}"><p class="noscript">This tool needs JavaScript. Everything runs in your browser; nothing is uploaded.</p></div></section>
${t.notice ? `<p class="notice"><strong>Note:</strong> ${esc(t.notice)}</p>` : ""}
${t.how.map((h) => `<h2>${esc(h.heading)}</h2><p>${esc(h.body)}</p>`).join("")}
<h2>Frequently asked questions</h2>
<div class="faq">${t.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
<h2 style="margin-top:40px">More free tools</h2>
<div class="cards">${related.map((r) => `<a href="/${r.slug}/"><strong>${esc(r.nav)}</strong><span>${esc(r.description)}</span></a>`).join("")}</div>
${chatSection(t)}
<script src="/app.js" defer></script>`;
  return layout({
    title: t.title, description: t.description, path, body, current: t.slug,
    ld: [
      { "@context": "https://schema.org", "@type": "WebApplication", name: t.h1, url: `${SITE_URL}${path}`, description: t.description, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  });
}

function homePage() {
  const body = `
<h1>Free, exact online tools</h1>
<p class="lead">Fast utilities that run in your browser with no signup, and connect to AI assistants so they stop guessing at counts, dates and math.</p>
<div class="cards">${TOOLS.map((t) => `<a href="/${t.slug}/"><strong>${esc(t.h1)}</strong><span>${esc(t.description)}</span></a>`).join("")}</div>`;
  return layout({ title: `${SITE_NAME}: Free Online Tools That Give Exact Answers`, description: "Free QR code, word counter, password, age and loan calculators. No signup. Also available inside AI chat.", path: "/", body });
}

function connectPage() {
  const toolList = `<ul>
<li><code>create_qr_code</code>: create a QR code image</li><li><code>count_text</code>: exact word and character counts</li>
<li><code>generate_password</code>: cryptographically random password</li><li><code>calculate_age</code> and <code>date_math</code>: ages, date differences, adding days</li>
<li><code>calculate_loan_payment</code>: loan and mortgage payments</li></ul>`;
  const how = MCP_URL
    ? `<h2>Connect</h2><p>The server URL is <code>${esc(MCP_URL)}</code>. It needs no account or login.</p>
<ul><li><strong>ChatGPT</strong>: Settings → Apps &amp; Connectors → enable developer mode → create, and paste the URL.</li>
<li><strong>Claude</strong>: Settings → Connectors → Add custom connector, and paste the URL.</li>
<li><strong>Grok and other MCP clients</strong>: add a remote MCP server with this URL.</li></ul>
<p class="muted">Menu names change between releases; these are the usual places to look.</p>`
    : `<h2>Status</h2><p>The connector is not publicly deployed yet. Once it is, this page will show the server URL and the steps to add it to ChatGPT, Claude and Grok.</p>`;
  const body = `<h1>Use ${esc(SITE_NAME)} inside AI chat</h1><p class="lead">A single connector (an MCP server) gives AI assistants exact tools, so you get correct answers instead of estimates.</p><h2>What it can do</h2>${toolList}${how}`;
  return layout({ title: `${SITE_NAME} for ChatGPT, Claude & Grok`, description: "Add exact QR, counting, password, date and loan tools to ChatGPT, Claude and Grok through one MCP connector.", path: "/connect/", body });
}

function privacyPage() {
  const contact = CONTACT ? `<a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : "<strong>[contact email not set]</strong>";
  const body = `<h1>Privacy policy</h1><p class="muted">Last updated ${UPDATED}</p>
<h2>Website tools</h2><p>The calculators and generators on this website run entirely in your browser. The text, dates, amounts and passwords you enter are not sent to our servers. This site does not use accounts, advertising or analytics cookies.</p>
<h2>AI chat connector</h2><p>When you use the connector through an AI assistant, the inputs that the assistant sends to a tool (for example the text to count, a birth date, or loan figures) are sent to our server so it can compute the result. We process them in memory to produce the response and do not store them, do not log them, do not sell or share them, and do not use them for training or advertising. The connector requires no login and we collect no personal information about you.</p>
<p>Results, including any password the connector generates, are returned to your AI assistant and become part of that conversation under the assistant provider's own policies. For important passwords, use the generator on our website instead.</p>
<h2>Hosting and logs</h2><p>Our hosting provider may keep standard technical request logs (such as IP address and timestamp) for security and operations. We do not combine these with any tool inputs.</p>
<h2>Data retention</h2><p>We retain no tool inputs or outputs. Standard hosting logs are kept only as long as the provider's default retention.</p>
<h2>Children</h2><p>The service is not directed at children under 13 and we do not knowingly collect their information.</p>
<h2>Changes</h2><p>We will update this page and its date if our practices change.</p>
<h2>Contact</h2><p>Questions: ${contact}</p>`;
  return layout({ title: `Privacy Policy | ${SITE_NAME}`, description: `How ${SITE_NAME} handles your data.`, path: "/privacy/", body });
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const write = async (rel: string, content: string) => {
  const file = `${OUT}/${rel}`;
  await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  await writeFile(file, content);
};

await write("index.html", homePage());
for (const t of TOOLS) await write(`${t.slug}/index.html`, toolPage(t));
await write("connect/index.html", connectPage());
await write("privacy/index.html", privacyPage());
await cp("site/style.css", `${OUT}/style.css`);
await build({ entryPoints: ["site/client.ts"], outfile: `${OUT}/app.js`, bundle: true, minify: true, format: "iife", target: "es2022", platform: "browser", logLevel: "warning" });

const urls = ["/", ...TOOLS.map((t) => `/${t.slug}/`), "/connect/", "/privacy/"];
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${urls.length} pages → ${OUT} (SITE_URL=${SITE_URL})`);
if (!process.env.SITE_URL) console.warn("WARN: SITE_URL not set; canonical URLs and sitemap use https://example.com");
if (!CONTACT) console.warn("WARN: CONTACT_EMAIL not set; the privacy page shows a placeholder");

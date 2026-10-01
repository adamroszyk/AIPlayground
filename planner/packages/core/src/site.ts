import { cp, mkdir, rm, writeFile } from "node:fs/promises";

export interface Faq { q: string; a: string }
export interface Item { title: string; body: string }

export interface ProductConfig {
  key: "home" | "wedding";
  name: string;
  /** Short noun phrase used in legal text, e.g. "room layout planner". */
  kind: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  sub: string;
  heroSvg: string;
  heroCaption: string;
  stepsHeading: string;
  steps: Item[];
  checksHeading: string;
  checksIntro: string;
  checks: string[];
  featuresHeading: string;
  features: Item[];
  limitsHeading: string;
  limits: string[];
  faq: Faq[];
  headingFont: string;
  tokens: { light: Record<string, string>; dark: Record<string, string> };
  /** Product-specific data handling, used by the privacy policy. */
  data: { planData: string[]; planRetentionDays: number; thirdPartyNote?: string };
  /** Product-specific disclaimer used in terms. */
  disclaimer: string;
}

export interface SiteEnv {
  siteUrl: string;
  publisher: string;
  contactEmail: string;
  effectiveDate: string;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

const tokenCss = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(";");

export function css(cfg: ProductConfig): string {
  return `:root{${tokenCss(cfg.tokens.light)};--font-head:${cfg.headingFont};color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{${tokenCss(cfg.tokens.dark)}}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}img,svg{max-width:100%;height:auto}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:20px;padding-top:14px;padding-bottom:14px}
.brand{font:700 22px var(--font-head);color:var(--fg);text-decoration:none;margin-right:auto;letter-spacing:.2px}
header.top nav{display:flex;gap:18px}header.top nav a{color:var(--muted);text-decoration:none;font-size:15px}header.top nav a:hover{color:var(--fg)}header.top nav a.btn,header.top nav a.btn:hover{color:var(--accent-fg)}
@media(max-width:640px){header.top nav a:not(.cta){display:none}}
.btn{display:inline-block;padding:12px 22px;border-radius:999px;background:var(--accent);color:var(--accent-fg);font-weight:600;text-decoration:none;border:0;cursor:pointer;font-size:16px}
.btn:hover{filter:brightness(1.08)}.btn.small{padding:8px 16px;font-size:14px}
.hero{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center;padding:64px 0 40px}
@media(max-width:860px){.hero{grid-template-columns:1fr;padding-top:36px;gap:28px}}
.eyebrow{display:inline-block;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:14px}
h1{font:700 clamp(34px,5.4vw,56px)/1.08 var(--font-head);margin:0 0 18px;letter-spacing:-.5px}
h2{font:700 clamp(26px,3.6vw,36px)/1.15 var(--font-head);margin:0 0 14px}
h3{font:600 19px var(--font-head);margin:0 0 6px}
.lead{font-size:19px;color:var(--muted);margin:0 0 26px;max-width:560px}
.hero-art{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px}
.hero-art figcaption{font-size:13px;color:var(--muted);margin-top:10px;text-align:center}
.signup{display:flex;gap:10px;flex-wrap:wrap;max-width:520px}
.signup input[type=email]{flex:1 1 220px;padding:13px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:inherit}
.signup .hp,.sr{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.lead.flush{margin-bottom:0}.lead.center{margin:0 auto}.h2s{font-size:24px}
.signup-msg{flex-basis:100%;margin:0;font-size:15px;min-height:1.4em}
.signup-msg.ok{color:var(--ok)}.signup-msg.err{color:var(--err)}
.fine{font-size:13px;color:var(--muted);margin-top:10px;max-width:520px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
section.block{padding:56px 0;border-top:1px solid var(--line)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;counter-reset:s;margin-top:26px}
.step{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;position:relative}
.step:before{counter-increment:s;content:counter(s);display:inline-flex;width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--accent-fg);align-items:center;justify-content:center;font-weight:700;margin-bottom:12px}
.step p,.feature p{margin:0;color:var(--muted);font-size:16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
@media(max-width:860px){.two{grid-template-columns:1fr}}
.checks{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:10px}
.checks li{padding-left:34px;position:relative}
.checks li:before{content:"";position:absolute;left:0;top:5px;width:20px;height:20px;border-radius:50%;background:var(--ok)}
.checks li:after{content:"";position:absolute;left:6px;top:9px;width:8px;height:4px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:26px}
.feature{padding:4px 0}
.limits{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px 26px}
.limits ul{margin:12px 0 0;padding-left:20px;color:var(--muted)}.limits li{margin:6px 0}
.faq details{border-bottom:1px solid var(--line);padding:14px 0}.faq summary{cursor:pointer;font-weight:600}
.faq p{margin:10px 0 0;color:var(--muted)}
.cta-band{text-align:center;padding:64px 0}.cta-band .signup{margin:22px auto 0;justify-content:center}.cta-band .fine{margin-left:auto;margin-right:auto}
footer{border-top:1px solid var(--line);padding:30px 0 50px;color:var(--muted);font-size:14px}
footer .wrap{display:flex;gap:18px;flex-wrap:wrap;align-items:center}footer a{color:var(--muted)}footer .sp{margin-right:auto}
.legal{max-width:760px;margin:0 auto;padding:44px 20px 80px}.legal h1{font-size:clamp(30px,4vw,42px)}.legal h2{font-size:22px;margin-top:34px}
.legal table{border-collapse:collapse;width:100%;font-size:15px;margin:12px 0}.legal th,.legal td{border:1px solid var(--line);padding:9px 11px;text-align:left;vertical-align:top}
.legal .draft{background:var(--card);border-left:4px solid var(--accent);padding:10px 14px;border-radius:0 10px 10px 0;font-size:15px;color:var(--muted)}
/* illustration classes */
.art{width:100%}
.art text{font:15px system-ui,sans-serif;fill:var(--muted)}
.art .t-strong{fill:var(--fg);font-weight:600}
.art .wall{fill:none;stroke:var(--fg);stroke-width:5;stroke-linejoin:round}
.art .floor{fill:var(--floor)}.art .rug{fill:var(--rug)}
.art .item{fill:var(--item);stroke:var(--item-line);stroke-width:1.5}
.art .item2{fill:var(--item2);stroke:var(--item-line);stroke-width:1.5}
.art .swing{fill:var(--accent);fill-opacity:.12;stroke:var(--accent);stroke-width:1.5;stroke-dasharray:5 4}
.art .walk{fill:var(--ok);fill-opacity:.12;stroke:var(--ok);stroke-width:1.5;stroke-dasharray:6 4}
.art .win{stroke:var(--accent2);stroke-width:5}
.art .dim{stroke:var(--muted);stroke-width:1}
.art .badge{fill:var(--ok)}.art .badge-t{fill:#fff;font-weight:700;font-size:15px}
.art .tbl{fill:var(--item);stroke:var(--item-line);stroke-width:1.5}
.art .g1{fill:var(--g1)}.art .g2{fill:var(--g2)}.art .g3{fill:var(--g3)}.art .g4{fill:var(--g4)}.art .g5{fill:var(--g5)}
.art .apart{stroke:var(--err);stroke-width:2;stroke-dasharray:5 4;fill:none}
.art .togeth{stroke:var(--ok);stroke-width:2;fill:none}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-top:8px;justify-content:center}
.legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.g1i{background:var(--g1)}.g2i{background:var(--g2)}.g3i{background:var(--g3)}.g4i{background:var(--g4)}
`;
}

const signupForm = (id: string) => `<form class="signup" data-signup novalidate>
<label class="sr" for="em-${id}">Email address</label>
<input id="em-${id}" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
<input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="btn" type="submit">Get early access</button>
<p class="signup-msg" role="status" aria-live="polite"></p>
</form>`;

function shell(cfg: ProductConfig, env: SiteEnv, o: { title: string; description: string; path: string; body: string; ld?: unknown[]; script?: boolean; noindex?: boolean }) {
  const url = `${env.siteUrl}${o.path}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${esc(cfg.name)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="${cfg.tokens.light.accent}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
${(o.ld ?? []).map(jsonLd).join("\n")}
</head><body>
<header class="top"><div class="wrap"><a class="brand" href="/">${esc(cfg.name)}</a><nav aria-label="Main"><a href="/#how">How it works</a><a href="/#faq">FAQ</a><a href="/support/">Support</a><a class="btn small cta" href="/#join">Early access</a></nav></div></header>
${o.body}
<footer><div class="wrap"><span class="sp">© ${new Date().getFullYear()} ${esc(env.publisher)}</span><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div></footer>
${o.script ? '<script src="/app.js" defer></script>' : ""}
</body></html>`;
}

export function renderLanding(cfg: ProductConfig, env: SiteEnv): string {
  const body = `<main>
<div class="wrap">
<section class="hero" id="join">
<div>
<span class="eyebrow">${esc(cfg.eyebrow)}</span>
<h1>${esc(cfg.headline)}</h1>
<p class="lead">${esc(cfg.sub)}</p>
${signupForm("hero")}
<p class="fine">Early access. One email when it opens, nothing else. <a href="/privacy/">Privacy</a></p>
</div>
<figure class="hero-art" aria-label="Example output">${cfg.heroSvg}<figcaption>${esc(cfg.heroCaption)}</figcaption></figure>
</section>

<section class="block" id="how"><h2>${esc(cfg.stepsHeading)}</h2>
<div class="steps">${cfg.steps.map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join("")}</div></section>

<section class="block"><div class="two">
<div><h2>${esc(cfg.checksHeading)}</h2><p class="lead flush">${esc(cfg.checksIntro)}</p></div>
<ul class="checks">${cfg.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
</div></section>

<section class="block"><h2>${esc(cfg.featuresHeading)}</h2>
<div class="features">${cfg.features.map((f) => `<div class="feature"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></div>`).join("")}</div></section>

<section class="block"><div class="limits"><h2 class="h2s">${esc(cfg.limitsHeading)}</h2><ul>${cfg.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div></section>

<section class="block faq" id="faq"><h2>Questions</h2>${cfg.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>

<section class="block cta-band"><h2>${esc(cfg.name)} is opening soon</h2><p class="lead center">Join the list and we will email you once, when early access opens.</p>${signupForm("cta")}</section>
</div></main>`;
  return shell(cfg, env, {
    title: cfg.metaTitle,
    description: cfg.metaDescription,
    path: "/",
    body,
    script: true,
    ld: [
      { "@context": "https://schema.org", "@type": "WebApplication", name: cfg.name, url: env.siteUrl, description: cfg.metaDescription, applicationCategory: "LifestyleApplication", operatingSystem: "Any", publisher: { "@type": "Organization", name: env.publisher } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: cfg.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  });
}

const contactHtml = (env: SiteEnv) => (env.contactEmail ? `<a href="mailto:${esc(env.contactEmail)}">${esc(env.contactEmail)}</a>` : "<strong>[contact email not set]</strong>");

export function renderPrivacy(cfg: ProductConfig, env: SiteEnv): string {
  const body = `<main class="legal">
<h1>Privacy policy</h1>
<p class="draft">Draft describing how ${esc(cfg.name)} is designed to work. Effective ${esc(env.effectiveDate)}. This page must be reviewed against the shipped behaviour and by a lawyer before launch.</p>
<h2>Who we are</h2>
<p>${esc(cfg.name)} is a ${esc(cfg.kind)} published by ${esc(env.publisher)}. Contact: ${contactHtml(env)}.</p>
<h2>What we collect, why, and who receives it</h2>
<table><thead><tr><th>Category</th><th>Examples</th><th>Purpose</th><th>Recipients</th></tr></thead><tbody>
<tr><td>Early-access email</td><td>The address you submit on this site</td><td>To email you once when early access opens, and to answer you if you write to us</td><td>Cloudflare (hosting and storage provider acting for us)</td></tr>
<tr><td>Plans you create</td><td>${cfg.data.planData.map(esc).join("; ")}</td><td>To generate, verify, display and let you edit your plan, and to give you a link you can share</td><td>Cloudflare (hosting and storage). If you use ${esc(cfg.name)} through ChatGPT, OpenAI also receives what you type, under its own policy${cfg.data.thirdPartyNote ? ". " + esc(cfg.data.thirdPartyNote) : ""}</td></tr>
<tr><td>Technical logs</td><td>IP address, user agent, timestamp of requests</td><td>Security, abuse prevention and reliability</td><td>Cloudflare</td></tr>
</tbody></table>
<p>We do not require an account, do not collect payment details, do not use advertising identifiers, and do not run analytics or tracking cookies. We do not sell personal data or share it for advertising.</p>
<h2>Retention</h2>
<ul><li>Early-access emails are kept until you ask us to delete them.</li>
<li>Plans are deleted automatically <strong>${cfg.data.planRetentionDays} days after they were last edited</strong>.</li>
<li>Technical logs are kept for the period set by our hosting provider.</li></ul>
<h2>Your controls</h2>
<ul><li>Every plan has a private link and a delete link. Anyone with the plan link can view it, so share it carefully.</li>
<li>Email ${contactHtml(env)} to delete your early-access email or any plan, or to ask what we hold about you.</li></ul>
<h2>Other people's information</h2>
<p>If you enter information about other people (for example guest names), please use only what you need. First names or initials are enough.</p>
<h2>Children</h2>
<p>${esc(cfg.name)} is not directed at children under 13 and we do not knowingly collect their personal data.</p>
<h2>International users</h2>
<p>Our hosting provider operates globally, so data may be processed outside your country. Contact us to exercise any rights you have under local law.</p>
<h2>Changes</h2>
<p>We will update this page and its date when our practices change.</p>
</main>`;
  return shell(cfg, env, { title: `Privacy policy | ${cfg.name}`, description: `How ${cfg.name} handles your data.`, path: "/privacy/", body });
}

export function renderTerms(cfg: ProductConfig, env: SiteEnv): string {
  const body = `<main class="legal">
<h1>Terms of service</h1>
<p class="draft">Draft. Effective ${esc(env.effectiveDate)}. Governing law and venue are not set yet. A lawyer must review this page before launch.</p>
<h2>The service</h2>
<p>${esc(cfg.name)} is a ${esc(cfg.kind)} provided by ${esc(env.publisher)} (“we”). You may use it through this website and through AI assistants that connect to it.</p>
<h2>Estimates, not professional advice</h2>
<p>${esc(cfg.disclaimer)}</p>
<h2>Acceptable use</h2>
<p>Do not use the service to break the law, to attack or overload it, to scrape it at scale, or to store content you have no right to store. We may limit or suspend access to protect the service.</p>
<h2>Your content</h2>
<p>You keep ownership of what you enter. You give us permission to store and process it only to provide the service as described in the <a href="/privacy/">privacy policy</a>.</p>
<h2>No commerce</h2>
<p>The service does not sell goods or process payments.</p>
<h2>Availability and changes</h2>
<p>The service is provided as is and may change, be interrupted or be discontinued. Early access may have limits.</p>
<h2>Liability</h2>
<p>To the extent the law allows, we are not liable for indirect or consequential losses, or for decisions you make based on outputs. Nothing in these terms limits liability that cannot be limited by law.</p>
<h2>Contact</h2>
<p>${contactHtml(env)}</p>
</main>`;
  return shell(cfg, env, { title: `Terms of service | ${cfg.name}`, description: `Terms for using ${cfg.name}.`, path: "/terms/", body });
}

export function renderSupport(cfg: ProductConfig, env: SiteEnv): string {
  const body = `<main class="legal">
<h1>Support</h1>
<h2>Contact</h2>
<p>Write to ${contactHtml(env)} and include the plan link if your question is about a specific plan. We reply by email.</p>
<h2>Common requests</h2>
<ul>
<li><strong>Delete a plan:</strong> open the delete link you received with the plan, or email us the plan link.</li>
<li><strong>Delete my early-access email:</strong> email us from that address.</li>
<li><strong>Report a wrong result:</strong> send the plan link and what you expected. Wrong results are treated as bugs.</li>
</ul>
<h2>Using ${esc(cfg.name)} in ChatGPT</h2>
<p>${esc(cfg.name)} is being prepared for the ChatGPT plugin directory. Until it is listed, access is through early access only.</p>
<h2>Policies</h2>
<p><a href="/privacy/">Privacy policy</a> · <a href="/terms/">Terms of service</a></p>
</main>`;
  return shell(cfg, env, { title: `Support | ${cfg.name}`, description: `Get help with ${cfg.name}.`, path: "/support/", body });
}

const APP_JS = `(()=>{
const forms=document.querySelectorAll('[data-signup]');
forms.forEach((f)=>{f.addEventListener('submit',async(e)=>{
e.preventDefault();
const msg=f.querySelector('.signup-msg');const btn=f.querySelector('button');
const email=f.querySelector('input[name=email]').value.trim();
const company=f.querySelector('input[name=company]').value;
const set=(t,c)=>{msg.textContent=t;msg.className='signup-msg '+c};
if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){set('Please enter a valid email address.','err');return}
btn.disabled=true;set('Saving…','');
try{
const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,company})});
if(r.ok){set('You are on the list. We will email you once when early access opens.','ok');f.querySelector('input[name=email]').value=''}
else{const j=await r.json().catch(()=>({}));set(j.error||'Something went wrong. Please try again.','err')}
}catch{set('Network error. Please try again.','err')}
btn.disabled=false;
})});
})();`;

const FAVICON = (c: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${c}"/><path d="M8 22V12l8-5 8 5v10z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

export async function buildSite(cfg: ProductConfig, env: SiteEnv, outDir: string) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const w = async (rel: string, content: string) => {
    const file = `${outDir}/${rel}`;
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, content);
  };
  await w("index.html", renderLanding(cfg, env));
  await w("privacy/index.html", renderPrivacy(cfg, env));
  await w("terms/index.html", renderTerms(cfg, env));
  await w("support/index.html", renderSupport(cfg, env));
  await w("404.html", shell(cfg, env, { title: `Not found | ${cfg.name}`, description: "Page not found.", path: "/404", noindex: true, body: `<main class="legal"><h1>Page not found</h1><p><a href="/">Back to ${esc(cfg.name)}</a></p></main>` }));
  await w("style.css", css(cfg));
  await w("app.js", APP_JS);
  await w("favicon.svg", FAVICON(cfg.tokens.light.accent!));
  await w("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${env.siteUrl}/sitemap.xml\n`);
  const urls = ["/", "/privacy/", "/terms/", "/support/"];
  await w("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${env.siteUrl}${u}</loc><lastmod>${env.effectiveDate}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  await w(
    "_headers",
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'\n`,
  );
  return urls;
}

export function envFromProcess(defaults: { siteUrl: string }): SiteEnv {
  const siteUrl = (process.env.SITE_URL ?? defaults.siteUrl).replace(/\/$/, "");
  return {
    siteUrl,
    publisher: process.env.PUBLISHER_NAME ?? "[Publisher name]",
    contactEmail: process.env.CONTACT_EMAIL ?? "",
    effectiveDate: process.env.EFFECTIVE_DATE ?? new Date().toISOString().slice(0, 10),
  };
}

export { cp };

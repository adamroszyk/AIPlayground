// Landing-page end-to-end test: starts both apps on the Workers runtime (workerd), drives them in Chromium.
// Run: npm run test:landing   (set CHROMIUM=/path/to/chromium if the default is not found)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

const SP = process.env.SHOTS ?? "tests/.shots";
await mkdir(SP, { recursive: true });
const procs = [];
async function start(dir, port, inspector) {
  const p = spawn("npx", ["wrangler", "dev", "--local", "--port", String(port), "--inspector-port", String(inspector)], { cwd: dir, stdio: "ignore", detached: true });
  procs.push(p);
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`wrangler dev did not start in ${dir}`);
}
const stop = () => procs.forEach((p) => { try { process.kill(-p.pid, "SIGKILL"); } catch {} });
process.on("exit", stop);
await start("apps/home", 8787, 9229);
await start("apps/wedding", 8788, 9330);
const apps = [["home", "http://127.0.0.1:8787", "Roomwise"], ["wedding", "http://127.0.0.1:8788", "Aisle"]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
for (const [key, base, name] of apps) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/");
  ok((await page.title()).length <= 62, `${key}: title ${(await page.title()).length} chars`);
  const desc = await page.getAttribute("meta[name=description]", "content");
  ok(desc.length <= 160, `${key}: description ${desc.length} chars`);
  ok((await page.locator("h1").count()) === 1, `${key}: one h1`);
  ok((await page.locator('script[type="application/ld+json"]').count()) === 2, `${key}: JSON-LD x2`);
  await page.screenshot({ path: `${SP}/p1-${key}-desktop.png`, fullPage: true });

  // waitlist: invalid, valid, duplicate, honeypot
  const form = page.locator("[data-signup]").first();
  await form.locator("input[name=email]").fill("not-an-email");
  await form.locator("button").click();
  ok(/valid email/i.test(await form.locator(".signup-msg").innerText()), `${key}: invalid email is rejected client-side`);
  await form.locator("input[name=email]").fill(`Tester+${key}@Example.com`);
  await form.locator("button").click();
  await page.waitForFunction(() => /on the list/i.test(document.querySelector(".signup-msg").textContent));
  ok(true, `${key}: valid email accepted`);
  const r1 = await page.request.post(base + "/api/waitlist", { data: { email: `tester+${key}@example.com` } });
  ok(r1.status() === 200, `${key}: duplicate email is idempotent`);
  const r2 = await page.request.post(base + "/api/waitlist", { data: { email: "bot@example.com", company: "Acme" } });
  ok(r2.status() === 200, `${key}: honeypot looks successful to bots`);
  const r3 = await page.request.post(base + "/api/waitlist", { data: { email: "x" } });
  ok(r3.status() === 400, `${key}: server rejects bad email`);
  const r4 = await page.request.get(base + "/api/waitlist");
  ok(r4.status() === 405, `${key}: GET not allowed`);
  const r5 = await page.request.post(base + "/api/waitlist", { data: "x".repeat(5000), headers: { "content-type": "application/json" } });
  ok(r5.status() === 413, `${key}: oversized body rejected`);
  const c = await page.request.get(base + "/.well-known/openai-apps-challenge");
  ok(c.status() === 404, `${key}: challenge route 404 until secret is set`);

  for (const p of ["/privacy/", "/terms/", "/support/", "/sitemap.xml", "/robots.txt", "/favicon.svg"]) {
    const res = await page.request.get(base + p);
    ok(res.status() === 200, `${key}: ${p} 200`);
  }
  const nf = await page.request.get(base + "/nope");
  ok(nf.status() === 404, `${key}: unknown path 404`);
  await page.goto(base + "/privacy/");
  const priv = await page.locator("main").innerText();
  ok(/retention/i.test(priv) && /90 days/.test(priv) && /Cloudflare/.test(priv) && /delete/i.test(priv), `${key}: privacy covers data, purpose, recipients, retention, controls`);
  await page.screenshot({ path: `${SP}/p1-${key}-privacy.png` });

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(base + "/");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${key}: no horizontal scroll at 375px`);
  await page.screenshot({ path: `${SP}/p1-${key}-mobile.png`, fullPage: true });
  ok(errors.length === 0, `${key}: no console errors (CSP clean)` + (errors.length ? " -> " + errors.join(" | ") : ""));
  await page.close();
}
await browser.close();
stop();
process.exit(fails ? 1 : 0);

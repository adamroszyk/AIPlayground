// Widget end-to-end: both products, rendered through an AppBridge host in Chromium against live Workers.
import { chromium } from "playwright";
import { build } from "esbuild";
import http from "node:http";
import { mkdir } from "node:fs/promises";
import { startWorker } from "./helpers.mjs";

const SHOTS = process.env.SHOTS ?? "tests/.shots";
await mkdir(SHOTS, { recursive: true });
const bundle = await build({ entryPoints: ["tests/widget-host.ts"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022" });
const hostJs = bundle.outputFiles[0].text;
const web = http.createServer((req, res) => {
  if (req.url === "/host.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(hostJs);
  res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><body style="margin:8px"><script src="/host.js"></script>');
}).listen(4181);

const home = startWorker("apps/home", 8793, 9393), wed = startWorker("apps/wedding", 8794, 9394);
await Promise.all([home.ready(), wed.ready()]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const cases = [
  { key: "home", server: home.base, tool: "plan_room_layout", uri: "ui://roomwise/plan.html", svg: "svg.rp-plan", args: { unit: "in", room: { width: 168, length: 144, doors: [{ wall: "south", offset: 96, width: 32 }], windows: [{ wall: "north", offset: 54, width: 60 }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 84, depth: 36 }, { name: "Coffee table", kind: "coffee_table", width: 40, depth: 20 }, { name: "Armchair", kind: "chair", width: 32, depth: 32 }, { name: "TV unit", kind: "tv", width: 60, depth: 16 }, { name: "Side table", kind: "side_table", width: 18, depth: 18 }, { name: `<img src=x onerror=window.__pwn=1>`, kind: "generic", width: 14, depth: 14 }] }, badge: /checks passed/ },
  { key: "wedding", server: wed.base, tool: "plan_wedding_seating", uri: "ui://aisle/seating.html", svg: "svg.rp-seating", args: { guests: [...Array.from({ length: 23 }, (_, i) => ({ name: `Guest <${i + 1}> & Co`, group: `G${i % 4}` })), { name: `"><img src=x onerror=window.__pwn=1>`, group: `<b>x</b>` }], tables: [{ name: "Head table", seats: 6, head: true }, { seats: 6, count: 3 }], rules: [{ type: "apart", a: "Guest <1> & Co", b: "Guest <2> & Co" }, { type: "head_table", guests: ["Guest <5> & Co"] }] }, badge: /rules met/ },
];
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 620, height: 820 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:4181/?server=${encodeURIComponent(c.server)}&tool=${c.tool}&uri=${encodeURIComponent(c.uri)}&args=${encodeURIComponent(JSON.stringify(c.args))}`);
  const frame = page.frameLocator("iframe");
  try {
    await frame.locator(c.svg).waitFor({ timeout: 15000 });
    ok(true, `${c.key}: widget rendered an SVG`);
    const body = await frame.locator("body").innerText();
    ok(c.badge.test(await frame.locator(".rp-badge-t").textContent()), `${c.key}: result badge shows ${c.badge}`);
    ok((await frame.locator(".checks li").count()) >= 3, `${c.key}: rule list rendered`);
    const btn = frame.locator("button");
    ok((await btn.count()) === 1, `${c.key}: open-on-web button present`);
    await btn.click();
    await page.waitForFunction(() => window.__opened.length === 1);
    const opened = await page.evaluate(() => window.__opened[0]);
    ok(/\/p\/[A-Za-z0-9_-]{22}#k=/.test(opened), `${c.key}: button opens the edit link (${opened.slice(0, 40)}…)`);
    await page.waitForTimeout(500);
    ok((await frame.locator("svg img, .checks img, .checks script, svg script").count()) === 0, `${c.key}: hostile names did not inject elements`);
    ok((await frame.locator("body").evaluate(() => window.__pwn)) === undefined, `${c.key}: hostile names did not execute code`);
    if (c.key === "wedding") ok((await frame.locator("svg.rp-seating").innerHTML()).includes("Guest &lt;1&gt; &amp; Co"), "wedding: guest names with <, > and & are escaped in the SVG");
  } catch (e) { ok(false, `${c.key}: widget did not render: ${String(e).split("\n")[0]}`); }
  await frame.locator("body").evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/widget-${c.key}.png` });
  ok(errors.length === 0, `${c.key}: no page errors${errors.length ? " -> " + errors.join(" | ") : ""}`);
  await page.close();
}
await browser.close(); home.stop(); wed.stop(); web.close();
process.exit(fails ? 1 : 0);

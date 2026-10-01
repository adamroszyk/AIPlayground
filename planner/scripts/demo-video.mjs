// Records walkthrough videos of both products against the real servers: node scripts/demo-video.mjs [home|wedding]
// Output: dist/demo/<name>-demo.webm (+ .mp4 when ffmpeg can encode H.264). No audio; captions are drawn on screen.
import { chromium } from "playwright";
import { build } from "esbuild";
import http from "node:http";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { startWorker } from "../tests/helpers.mjs";

const only = process.argv[2];
const OUT = new URL("../dist/demo/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const hostJs = (await build({ entryPoints: [new URL("./demo/host.ts", import.meta.url).pathname], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022" })).outputFiles[0].text;
const hostHtml = await readFile(new URL("./demo/host.html", import.meta.url), "utf8");
const web = http.createServer((req, res) => (req.url === "/host.js" ? res.writeHead(200, { "content-type": "text/javascript" }).end(hostJs) : res.writeHead(200, { "content-type": "text/html" }).end(hostHtml))).listen(4182);

const W = 1440, H = 900;
const card = (title, sub, bullets = [], foot = "") => `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#1c2a29;color:#f3efe8;font-family:system-ui,sans-serif"><div style="max-width:980px;padding:0 48px"><div style="font-size:64px;font-weight:700;letter-spacing:-.02em">${title}</div><div style="font-size:30px;margin-top:14px;color:#9fd6cf">${sub}</div>${bullets.length ? `<ul style="margin:34px 0 0;padding-left:26px;font-size:26px;line-height:1.6">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}${foot ? `<div style="margin-top:40px;font-size:20px;color:#9aa;max-width:860px;line-height:1.5">${foot}</div>` : ""}</div>`;

const INIT = `
addEventListener("DOMContentLoaded", () => {
  const d = document.createElement("div"); d.id = "__cur";
  d.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(235,70,50,.6);border:2px solid #fff;box-shadow:0 0 0 1px #0004;pointer-events:none;left:-60px;top:-60px;transform:translate(-50%,-50%)";
  const c = document.createElement("div"); c.id = "__cap";
  c.style.cssText = "position:fixed;z-index:2147483646;left:50%;top:14px;transform:translateX(-50%);max-width:1100px;background:rgba(14,18,18,.88);color:#fff;font:600 24px/1.35 system-ui,sans-serif;padding:14px 26px;border-radius:14px;text-align:center;display:none;pointer-events:none";
  document.documentElement.append(d, c);
});
window.__cap = (t) => { const c = document.getElementById("__cap"); if (!c) return; c.textContent = t; c.style.display = t ? "block" : "none"; };
window.__cur = (x, y) => { const d = document.getElementById("__cur"); if (d) { d.style.left = x + "px"; d.style.top = y + "px"; } };
`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });

async function record(name, base, script) {
  const dir = `${OUT}.raw-${name}`;
  await rm(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, bypassCSP: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  const cap = async (t, ms) => { await page.evaluate((t) => window.__cap?.(t), t); await pause(ms); };
  let cx = 700, cy = 450;
  const move = async (x, y, steps = 14) => { for (let i = 1; i <= steps; i++) { const px = cx + ((x - cx) * i) / steps, py = cy + ((y - cy) * i) / steps; await page.mouse.move(px, py); await page.evaluate(([a, b]) => window.__cur?.(a, b), [px, py]); await pause(16); } cx = x; cy = y; };
  const click = async (loc) => { const b = await loc.boundingBox(); await move(b.x + b.width / 2, b.y + b.height / 2); await pause(250); await loc.click({ force: false }); await pause(350); };
  const showCard = async (html, ms) => { await page.setContent(html); await pause(ms); };
  try { await script({ page, pause, cap, move, click, showCard, base }); } finally { await ctx.close(); }
  const raw = await page.video().path();
  await rename(raw, `${OUT}${name}-demo.webm`);
  await rm(dir, { recursive: true, force: true });
  const mp4 = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${OUT}${name}-demo.webm`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", `${OUT}${name}-demo.mp4`]);
  console.log(`${name}: ${OUT}${name}-demo.webm${mp4.status === 0 ? " and .mp4" : " (mp4 not produced: ffmpeg lacks libx264)"}`);
}
const hostUrl = (base, tool, uri, prompt, args) => `http://localhost:4182/?server=${encodeURIComponent(base)}&tool=${tool}&uri=${encodeURIComponent(uri)}&prompt=${encodeURIComponent(prompt)}&args=${encodeURIComponent(JSON.stringify(args))}`;

// ---------------------------------------------------------------------------------------------
if (!only || only === "home") {
  const w = startWorker("apps/home", 8811, 9411);
  try {
    await w.ready();
    const prompt = "Plan a 14 by 12 foot living room with a sofa, a coffee table, an armchair and a TV unit. The door is on the south wall 8 feet from the west corner and there is a window on the north wall.";
    const args = { unit: "ft", save: true, room: { width: 14, length: 12, doors: [{ wall: "south", offset: 8, width: 2.67 }], windows: [{ wall: "north", offset: 4.5, width: 5 }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 7, depth: 3 }, { name: "Coffee table", kind: "coffee_table", width: 3.33, depth: 1.67 }, { name: "Armchair", kind: "chair", width: 2.67, depth: 2.67 }, { name: "TV unit", kind: "tv", width: 5, depth: 1.33 }] };
    await record("roomwise", w.base, async ({ page, pause, cap, move, click, showCard, base }) => {
      await showCard(card("Roomwise", "Room layouts that check out", ["Plan where furniture goes, to scale", "Every layout is checked against clearance rules", "Edit on the web; share a link; delete any time"], "Walkthrough of the plugin's tool, widget and web editor, recorded against the real MCP server."), 5500);

      // 1. tool call + widget
      await page.goto(hostUrl(base, "plan_room_layout", "ui://roomwise/plan.html", prompt, args));
      const frame = page.frameLocator("iframe");
      await frame.locator("svg.rp-plan").waitFor({ timeout: 20000 });
      await cap("The model calls plan_room_layout with the user's measurements. The server solves the layout and checks it.", 5500);
      await cap("The widget shows the plan to scale, with every check passed or failed and its measured value.", 5500);
      await frame.locator("body").evaluate(() => window.scrollTo(0, 400)).catch(() => {});
      await pause(1500);
      await cap("“Open and edit on the web” takes the user to the full editor.", 2500);
      await click(frame.locator("button").first());

      // 2. editor
      await page.waitForSelector("svg.rp-plan");
      await pause(800);
      await cap("The same plan in the web editor. Drag pieces; the rules are re-checked on every move.", 4500);
      const [ax, ay] = await (async () => { const b = await page.locator('g.rp-piece[data-id="p3"] rect').first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; })();
      const door = await page.evaluate(() => { const s = document.querySelector("svg.rp-plan"); const pt = s.createSVGPoint(); pt.x = 40 + 112 * 3; pt.y = 40 + 128 * 3; const r = pt.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; });
      await cap("Drag the armchair into the doorway…", 1800);
      await move(ax, ay); await pause(300); await page.mouse.down();
      await move(door[0], door[1], 22); await pause(300); await page.mouse.up(); await pause(900);
      await page.locator(".rchecks").scrollIntoViewIfNeeded();
      await cap("…and the checks fail, naming the rule and the measured value. Nothing is drawn as fine when it is not.", 6500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await click(page.getByRole("button", { name: "Plan layout" }));
      await cap("Plan layout re-solves the room: every check passes again.", 4500);
      await page.locator("#materials").scrollIntoViewIfNeeded();
      await cap("Materials: flooring with waste allowance, paint gallons, baseboard, and the assumptions used.", 6000);
      await page.evaluate(() => window.scrollTo(0, 0));

      // 3. save, share, delete
      await click(page.getByRole("button", { name: "Save changes" }));
      await cap("Saved plans have a private edit link and a separate read-only share link. They expire 90 days after the last edit.", 6500);
      const url = page.url();
      await page.goto(url.split("#")[0]);
      await page.waitForSelector("svg.rp-plan");
      await cap("Anyone with the share link can view the plan but not change it.", 5000);
      await page.goto(url); await page.waitForSelector("svg.rp-plan"); await page.reload(); await page.waitForSelector("svg.rp-plan");
      page.once("dialog", (d) => d.accept());
      await click(page.getByRole("button", { name: "Delete plan" }));
      await page.waitForURL(/\/app\/$/);
      await cap("Delete removes the plan immediately.", 3500);

      await showCard(card("What Roomwise does not do", "Say so plainly", ["It does not redesign a room from a photo or choose styles", "It does not order furniture or take payments", "It gives rules of thumb for comfort and access, not building-code or structural advice", "One rectangular room at a time"], "Plans are stored only as private links. No account is needed."), 7500);
    });
  } finally { w.stop(); }
}

// ---------------------------------------------------------------------------------------------
if (!only || only === "wedding") {
  const w = startWorker("apps/wedding", 8812, 9412);
  try {
    await w.ready();
    const prompt = "Seat my 16 wedding guests: a head table of 6 and two tables of 6. The couple, both sets of parents and Priya and Tom's partners go on the head table. Keep the college friends together, keep Alex and Sam apart, and put Neha at Table 1.";
    const g = (name, group, party) => ({ name, ...(group ? { group } : {}), ...(party ? { party } : {}) });
    const args = { save: true, guests: [g("Maya", "Couple"), g("Daniel", "Couple"), g("Priya Rao", "Maya's family", "Rao"), g("Arjun Rao", "Maya's family", "Rao"), g("Neha", "Maya's family"), g("Tom Whitfield", "Daniel's family", "Whitfield"), g("Helen Whitfield", "Daniel's family", "Whitfield"), g("Sam", "Daniel's family"), g("Jo", "College friends"), g("Alex", "College friends"), g("Kim", "College friends"), g("Lee", "College friends"), g("Rosa", "Work"), g("Ben", "Work"), g("Cara", "Work"), g("Dev", "Work")],
      tables: [{ name: "Head table", seats: 6, head: true }, { seats: 6, count: 2 }],
      rules: [{ type: "head_table", guests: ["Maya", "Daniel", "Priya Rao", "Arjun Rao", "Tom Whitfield", "Helen Whitfield"] }, { type: "together", group: "College friends" }, { type: "apart", a: "Alex", b: "Sam" }, { type: "fixed", guest: "Neha", table: "Table 1" }] };
    await record("aisle", w.base, async ({ page, pause, cap, move, click, showCard, base }) => {
      await showCard(card("Aisle", "Seating charts, rules checked", ["Seat guests around your rules", "Every rule is re-checked on the finished chart", "Edit on the web; plan the day-of timeline"], "Walkthrough of the plugin's tool, widget and web editor, recorded against the real MCP server."), 5500);

      await page.goto(hostUrl(base, "plan_wedding_seating", "ui://aisle/seating.html", prompt, args));
      const frame = page.frameLocator("iframe");
      await frame.locator("svg.rp-seating").waitFor({ timeout: 20000 });
      await cap("The model calls plan_wedding_seating with the guests, tables and rules. The server seats everyone and checks every rule.", 6000);
      await cap("The widget shows the chart and each rule as met or not.", 5000);
      await cap("“Open and edit on the web” takes the user to the full editor.", 2500);
      await click(frame.locator("button").first());

      await page.waitForSelector("svg.rp-seating");
      await pause(800);
      await cap("The same chart in the web editor. Drag a guest to another seat; the rules are re-checked on every move.", 5000);
      const seat = (n) => page.locator(`g.rp-seatg:has(title:text-is("${n}"))`);
      const ctr = async (loc) => { const b = await loc.locator("circle").first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      const drag = async (a, b) => { const [ax, ay] = await ctr(a), [bx, by] = Array.isArray(b) ? b : await ctr(b); await move(ax, ay); await pause(300); await page.mouse.down(); await move(bx, by, 22); await pause(300); await page.mouse.up(); await pause(700); };
      await cap("Swap Rosa (work) with Jo (college friends)…", 2200);
      await drag(seat("Rosa"), seat("Jo"));
      await cap("…and the “seat together” rule fails. The chart says so instead of quietly looking fine.", 5500);
      await page.locator(".rchecks").scrollIntoViewIfNeeded(); await pause(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await cap("A full table refuses another guest: drop Ben on the head table.", 2200);
      const hb = await page.locator("g.rp-table.rp-head rect.rp-tbl").boundingBox();
      await drag(seat("Ben"), [hb.x + hb.width / 2, hb.y + hb.height / 2]);
      await cap("The editor explains why instead of doing something surprising.", 4500);
      await click(page.getByRole("button", { name: "Plan seating" }));
      await cap("Plan seating rebuilds the chart: every rule is met again.", 4500);

      await cap("Rules are plain text, one per line. If they cannot all be met, Aisle says which ones conflict.", 4500);
      const rules = page.locator("#side textarea").nth(1);
      await rules.scrollIntoViewIfNeeded();
      await rules.fill("together: Alex, Sam\napart: Alex, Sam"); await rules.dispatchEvent("change");
      await click(page.getByRole("button", { name: "Plan seating" }));
      await page.locator("#conflicts").scrollIntoViewIfNeeded();
      await cap("Contradictory rules: Aisle names the conflict and the closest chart it could build.", 6500);
      await rules.fill("head: Maya, Daniel, Priya Rao, Arjun Rao, Tom Whitfield, Helen Whitfield\ntogether group: College friends\napart: Alex, Sam\nfixed: Neha @ Table 1"); await rules.dispatchEvent("change");
      await click(page.getByRole("button", { name: "Plan seating" }));
      await page.evaluate(() => window.scrollTo(0, 0));
      await pause(1200);

      const tl = page.getByRole("button", { name: "Build day-of timeline" });
      await tl.scrollIntoViewIfNeeded();
      await click(tl);
      await page.locator("#timeline").scrollIntoViewIfNeeded();
      await cap("The day-of timeline: buffers between segments, and warnings for a venue curfew or photos after sunset.", 6500);
      await page.evaluate(() => window.scrollTo(0, 0));

      await click(page.getByRole("button", { name: /^Save/ }));
      await cap("Saved charts have a private edit link and a read-only share link, and are deleted 90 days after the last edit.", 6500);
      const url = page.url();
      await page.goto(url.split("#")[0]); await page.waitForSelector("svg.rp-seating");
      await cap("Anyone with the share link can view the chart but not change it.", 5000);
      await page.goto(url); await page.waitForSelector("svg.rp-seating"); await page.reload(); await page.waitForSelector("svg.rp-seating");
      page.once("dialog", (d) => d.accept());
      await click(page.getByRole("button", { name: "Delete plan" }));
      await page.waitForURL(/\/app\/$/);
      await cap("Delete removes the chart immediately.", 3500);

      await showCard(card("What Aisle does not do", "Say so plainly", ["It does not book vendors, send invitations, or manage RSVPs and budgets", "It does not take payments", "It does not know your venue's floor plan: you give it the tables", "Use first names or initials where you can"], "Charts are stored only as private links. No account is needed."), 7500);
    });
  } finally { w.stop(); }
}
web.close();
await browser.close();

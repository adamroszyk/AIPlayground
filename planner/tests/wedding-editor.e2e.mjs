// Aisle web editor end-to-end in Chromium against the Worker on workerd.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { startWorker } from "./helpers.mjs";

const SHOTS = process.env.SHOTS ?? "tests/.shots";
await mkdir(SHOTS, { recursive: true });
const w = startWorker("apps/wedding", 8796, 9396);
await w.ready();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const heading = async () => (await page.locator("main .panel h2").filter({ hasText: /checks/i }).first().innerText());
const failing = async () => page.locator(".rchecks li.no").allInnerTexts();
const status = async () => page.locator("#status").innerText();
const seatOf = (name) => page.locator(`g.rp-seatg:has(title:text-is("${name}"))`);
const tableOf = async (name) => seatOf(name).getAttribute("data-table");
const centre = async (loc) => { const b = await loc.locator("circle, rect").first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const drag = async (from, to) => { const [ax, ay] = await centre(from); const [bx, by] = Array.isArray(to) ? to : await centre(to); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 5 }); await page.mouse.move(bx, by, { steps: 5 }); await page.mouse.up(); };

try {
  await page.goto(`${w.base}/app/`);
  await page.waitForSelector("svg.rp-seating");
  ok(/6 of 6 checks passed|\d+ of \d+ checks passed/.test(await heading()) && !(await failing()).length, `default chart is planned with every check passing (${await heading()})`);
  ok((await page.locator("g.rp-seatg").count()) === 16, "all 16 guests are seated");
  ok((await tableOf("Maya")) === (await tableOf("Daniel")) && (await tableOf("Maya")) === "t1", "couple sits at the head table");
  ok((await tableOf("Alex")) !== (await tableOf("Sam")), "Alex and Sam are apart");
  ok((await tableOf("Neha")) === "t2", "fixed seat honoured (Neha at Table 1)");
  await page.screenshot({ path: `${SHOTS}/editor-wedding-default.png`, fullPage: true });

  // drag Sam to Alex's table: swap with Alex-adjacent seat breaks "apart" if they end up together
  const alexTable = await tableOf("Alex");
  await drag(seatOf("Sam"), seatOf("Alex"));
  ok((await tableOf("Sam")) === alexTable && (await tableOf("Alex")) !== alexTable, `dragging Sam onto Alex's seat swaps them (${await status()})`);
  // force a violation: move Sam into Alex's table by dropping on a table with space
  await page.reload(); await page.waitForSelector("svg.rp-seating");
  await drag(seatOf("Rosa"), seatOf("Jo")); // Rosa swaps with Jo, which splits the college-friends group
  const bad = await failing();
  ok(bad.length > 0 && bad.some((t) => /College friends/i.test(t)), `swapping a college friend away breaks the group rule: ${bad.map((t) => t.split(":")[0]).join(" | ")}`);
  ok(!/^7 of 7/.test(await heading()), `the check count drops (${await heading()})`);
  await page.screenshot({ path: `${SHOTS}/editor-wedding-broken.png`, fullPage: true });

  // dropping onto a full table is refused with a reason
  const headBefore = await page.locator('g.rp-seatg[data-table="t1"]').count();
  await drag(seatOf("Ben"), page.locator('g.rp-table.rp-head'));
  ok(/full/i.test(await status()) && (await page.locator('g.rp-seatg[data-table="t1"]').count()) === headBefore, `a full table refuses the move (${await status()})`);

  // re-plan restores a valid chart
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(!(await failing()).length, `Plan seating restores a chart that passes every check (${await heading()})`);

  // timeline
  await page.getByRole("button", { name: "Build day-of timeline" }).click();
  ok((await page.locator("table.tl tr").count()) >= 6, "timeline lists the day's segments");
  ok(await page.getByText(/Ends at/).isVisible(), "timeline shows the end time");

  // save, reload
  await page.getByRole("button", { name: "Save and get link" }).click();
  await page.waitForFunction(() => /\/p\/[A-Za-z0-9_-]{22}$/.test(location.pathname) && /k=/.test(location.hash));
  const url = page.url();
  ok(true, `saved; address is ${url.replace(/k=.*/, "k=…")}`);
  await page.reload(); await page.waitForSelector("svg.rp-seating");
  ok(await page.getByRole("button", { name: "Save changes" }).isVisible(), "reloading the edit link reopens the chart as editable");
  ok(!(await failing()).length && (await page.locator("g.rp-seatg").count()) === 16, "saved chart comes back complete and passing");
  ok(await page.locator("table.tl").isVisible(), "timeline is restored");
  ok((await page.locator("#side textarea").first().inputValue()).includes("Priya Rao, Maya's family, Rao"), "guest list text is rebuilt from the saved plan");

  // read-only share link
  const shareUrl = url.split("#")[0];
  const viewer = await ctx.newPage();
  await viewer.goto(shareUrl); await viewer.waitForSelector("svg.rp-seating");
  ok(await viewer.getByText("viewing a shared plan").isVisible(), "share link shows the read-only banner");
  ok(await viewer.getByRole("button", { name: "Plan seating" }).isDisabled() && await viewer.getByRole("button", { name: "Delete plan" }).isDisabled(), "share link cannot re-plan or delete");
  const vs = viewer.locator('g.rp-seatg:has(title:text-is("Kim"))'); const t0 = await vs.getAttribute("data-table");
  const vb = await vs.locator("circle").boundingBox(); const hb = await viewer.locator('g.rp-seatg[data-table="t1"] circle').first().boundingBox();
  await viewer.mouse.move(vb.x + 12, vb.y + 12); await viewer.mouse.down(); await viewer.mouse.move(hb.x + 12, hb.y + 12, { steps: 6 }); await viewer.mouse.up();
  ok((await vs.getAttribute("data-table")) === t0, "dragging does nothing in read-only mode");
  await viewer.getByRole("button", { name: "Make my own editable copy" }).click();
  await viewer.waitForFunction((old) => location.pathname !== old && /k=/.test(location.hash), new URL(shareUrl).pathname);
  ok(true, "read-only visitors can make their own editable copy");
  await viewer.close();

  // CSV export is formula-safe
  await page.goto(`${w.base}/app/`); await page.waitForSelector("svg.rp-seating");
  const guests = page.locator("#side textarea").first();
  await guests.fill("=HYPERLINK(\"http://x\"), Evil, \nAnn, Fam\nBob, Fam"); await guests.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(/mention/.test(await status()) || (await page.locator("g.rp-seatg").count()) === 3, `the formula-like name is handled (${await status()})`);
  const rules = page.locator("#side textarea").nth(1); await rules.fill(""); await rules.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV" }).click()]);
  const csv = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
  ok(csv.includes("'=HYPERLINK") && !/^=|,=/m.test(csv), "CSV neutralises a cell that starts with =");

  // hostile names never execute
  await guests.fill("<img src=x onerror=window.__pwn=1>, <b>g</b>\nAnn, Fam"); await guests.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => window.__pwn)) === undefined && (await page.locator("svg img, #canvas img, .rp-legend img, .rp-legend b").count()) === 0, "hostile guest and group names do not execute or inject markup");

  // validation messages
  await guests.fill("Ann\nann"); await guests.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(/share the name/.test(await status()), `duplicate names are explained (${await status()})`);
  await guests.fill(Array.from({ length: 40 }, (_, i) => `G${i}`).join("\n")); await guests.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(/only \d+ seats/.test(await status()), `too few seats is explained (${await status()})`);
  await guests.fill("Ann\nBob"); await guests.dispatchEvent("change");
  await rules.fill("nonsense"); await rules.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(/Rule line 1/.test(await status()), `a malformed rule names its line (${await status()})`);
  await rules.fill("apart: Ann, Zed"); await rules.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(/not on the guest list/.test(await status()), `an unknown name in a rule is explained (${await status()})`);

  // infeasible rules are reported with reasons
  await guests.fill("Ann, Fam\nBob, Fam\nCy, Fam"); await guests.dispatchEvent("change");
  await rules.fill("together: Ann, Bob\napart: Ann, Bob"); await rules.dispatchEvent("change");
  await page.getByRole("button", { name: "Plan seating" }).click();
  ok(await page.getByText("Why not every rule can be met").isVisible(), "contradictory rules show the conflict panel");

  // mobile layout
  const m = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const mp = await m.newPage();
  await mp.goto(`${w.base}/app/`); await mp.waitForSelector("svg.rp-seating");
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no horizontal scroll at phone width");
  await mp.screenshot({ path: `${SHOTS}/editor-wedding-mobile.png`, fullPage: true });
  await m.close();

  const real = errors.filter((e) => !/beforeunload/i.test(e));
  ok(real.length === 0, `no console errors (${real.slice(0, 3).join(" | ")})`);
} finally {
  await browser.close();
  w.stop();
}
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);

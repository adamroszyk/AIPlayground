// Roomwise web editor end-to-end in Chromium against the Worker on workerd.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { startWorker } from "./helpers.mjs";

const SHOTS = process.env.SHOTS ?? "tests/.shots";
await mkdir(SHOTS, { recursive: true });
const w = startWorker("apps/home", 8795, 9395);
await w.ready();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const heading = async () => (await page.locator("main .panel h2").last().innerText());
const failing = async () => page.locator(".rchecks li.no").allInnerTexts();
const client = (x, y) => page.evaluate(([x, y]) => { const s = document.querySelector("svg.rp-plan"); const pt = s.createSVGPoint(); pt.x = 40 + x * 3; pt.y = 40 + y * 3; const r = pt.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
const centerOf = async (id) => { const b = await page.locator(`g.rp-piece[data-id="${id}"] rect`).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

await page.goto(`${w.base}/app/`);
await page.waitForSelector("svg.rp-plan");
ok(/7 of 7 checks passed/.test(await heading()), `default room is planned and passes all checks (${await heading()})`);
await page.screenshot({ path: `${SHOTS}/editor-home-default.png`, fullPage: true });

// rotate with the keyboard
const sofaW0 = (await page.locator('g.rp-piece[data-id="p1"] rect').first().boundingBox()).width;
await page.mouse.click(...(await centerOf("p1")));
await page.keyboard.press("r");
const sofaW1 = (await page.locator('g.rp-piece[data-id="p1"] rect').first().boundingBox()).width;
ok(Math.abs(sofaW0 - sofaW1) > 20, `rotate swaps the footprint (${sofaW0.toFixed(0)} px to ${sofaW1.toFixed(0)} px)`);
const afterRotate = await heading();

// drag the armchair into the door's swing zone: the door-swing rule must start failing, with the measured reason
const [ax, ay] = await centerOf("p3");
const [dx, dy] = await client(112, 128);
await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move((ax + dx) / 2, (ay + dy) / 2, { steps: 5 }); await page.mouse.move(dx, dy, { steps: 5 }); await page.mouse.up();
const bad = await failing();
ok(bad.length > 0 && bad.some((t) => /swing|overlap|walkway/i.test(t)), `dragging a chair into the doorway breaks rules: ${bad.map((t) => t.split(":")[0]).join(" | ")}`);
ok(!/7 of 7/.test(await heading()), `the badge count drops (${await heading()})`);
await page.screenshot({ path: `${SHOTS}/editor-home-broken.png`, fullPage: true });

// arrow keys nudge; re-planning restores a valid layout
await page.keyboard.press("ArrowLeft");
await page.getByRole("button", { name: "Plan layout" }).click();
ok(/7 of 7 checks passed/.test(await heading()), `Plan layout restores a layout that passes every check (${await heading()}; ${(await failing()).join(" | ")})`);

// save, get a link, reload
await page.getByRole("button", { name: "Save and get link" }).click();
await page.waitForFunction(() => /\/p\/[A-Za-z0-9_-]{22}$/.test(location.pathname) && /k=/.test(location.hash));
const url = page.url();
ok(true, `saved; address is ${url.replace(/k=.*/, "k=…")}`);
await page.reload();
await page.waitForSelector("svg.rp-plan");
ok(await page.getByRole("button", { name: "Save changes" }).isVisible(), "reloading the edit link reopens the plan as editable");
ok(/7 of 7 checks passed/.test(await heading()), "the saved plan comes back with its checks");

// the share link (no fragment) is read-only
const shareUrl = url.split("#")[0];
const viewer = await ctx.newPage();
await viewer.goto(shareUrl);
await viewer.waitForSelector("svg.rp-plan");
ok(await viewer.getByText("viewing a shared plan").isVisible(), "share link shows the read-only banner");
ok(await viewer.getByRole("button", { name: "Plan layout" }).isDisabled(), "share link cannot re-plan");
ok(await viewer.getByRole("button", { name: "Delete plan" }).isDisabled(), "share link cannot delete");
const before = await viewer.locator('g.rp-piece[data-id="p1"] rect').first().boundingBox();
await viewer.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await viewer.mouse.down(); await viewer.mouse.move(before.x + 80, before.y + 80, { steps: 4 }); await viewer.mouse.up();
const after = await viewer.locator('g.rp-piece[data-id="p1"] rect').first().boundingBox();
ok(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, "dragging does nothing in read-only mode");
await viewer.getByRole("button", { name: "Make my own editable copy" }).click();
await viewer.waitForFunction((old) => location.pathname !== old && /k=/.test(location.hash), new URL(shareUrl).pathname);
ok(true, "read-only visitors can make their own editable copy");
await viewer.close();

// delete
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Delete plan" }).click();
await page.waitForURL(/\/app\/$/);
ok((await fetch(`${w.base}/api/plans/${new URL(shareUrl).pathname.split("/").pop()}`)).status === 404, "deleting removes the plan");
const gone = await ctx.newPage(); await gone.goto(shareUrl);
ok(await gone.getByText(/not found/i).first().isVisible(), "a deleted plan shows a friendly message");
await gone.close();

// hostile input
await page.goto(`${w.base}/app/`);
await page.waitForSelector("svg.rp-plan");
const nameInput = page.locator('#side input[type="text"]').first();
await nameInput.fill("<img src=x onerror=window.__pwn=1>"); await nameInput.dispatchEvent("change");
await page.getByRole("button", { name: "Plan layout" }).click();
await page.waitForTimeout(300);
ok((await page.evaluate(() => window.__pwn)) === undefined && (await page.locator("svg img, .checks img").count()) === 0, "hostile piece names do not execute or inject markup");

// invalid input is explained, not crashed
const widthInput = page.locator("#side input[type=number]").first();
await widthInput.fill("1"); await widthInput.dispatchEvent("change");
await page.getByRole("button", { name: "Plan layout" }).click();
ok(/between 3 ft and 60 ft/.test(await page.locator("#status").innerText()), `a 1 ft room is rejected with a clear message (${await page.locator("#status").innerText()})`);

// units
await page.reload(); await page.waitForSelector("svg.rp-plan");
await page.locator("#side select").first().selectOption("in");
ok((await page.locator("#side input[type=number]").first().inputValue()) === "168", "switching units shows the same room in inches (168)");

// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${w.base}/app/`); await page.waitForSelector("svg.rp-plan");
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal scroll at 390 px");
await page.screenshot({ path: `${SHOTS}/editor-home-mobile.png`, fullPage: true });
ok(errors.filter((e) => !/Failed to load resource.*(404|500)|beforeunload/.test(e)).length === 0, `no console errors or CSP violations${errors.length ? " -> " + errors.join(" | ") : ""}`);
await browser.close(); w.stop();
process.exit(fails ? 1 : 0);

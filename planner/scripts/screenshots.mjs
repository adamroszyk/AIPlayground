// Captures the listing screenshots from the real editors: node scripts/screenshots.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { startWorker } from "../tests/helpers.mjs";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
try {
  for (const [dir, port, insp, wait] of [["home", 8805, 9405, "svg.rp-plan"], ["wedding", 8806, 9406, "svg.rp-seating"]]) {
    const w = startWorker(`apps/${dir}`, port, insp);
    try {
      await w.ready();
      await mkdir(`apps/${dir}/plugin/assets`, { recursive: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await page.goto(`${w.base}/app/`);
      await page.waitForSelector(wait);
      await page.screenshot({ path: `apps/${dir}/plugin/assets/screenshot-1.png` });
      if (dir === "wedding") { await page.getByRole("button", { name: "Build day-of timeline" }).click(); await page.locator("#timeline").scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await page.screenshot({ path: `apps/${dir}/plugin/assets/screenshot-2.png` }); }
      await page.close();
      console.log(`${dir}: screenshots written`);
    } finally { w.stop(); }
  }
} finally { await browser.close(); }

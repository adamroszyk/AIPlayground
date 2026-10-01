// Remembers the demo video link for a plugin, so the next `npm run package:plugins` puts it in the ZIP.
//   npm run demo-url -- roomwise https://youtu.be/...      (asks for anything you leave out)
import { ask } from "./cloudflare/prompt.mjs";
import { saveDemoUrl } from "./cloudflare/credentials.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const check = !process.argv.includes("--no-check");
let [product, url] = args;
try {
  if (!["roomwise", "aisle"].includes(product)) product = (await ask("Which plugin is this video for (roomwise or aisle)? ")).toLowerCase();
  if (!["roomwise", "aisle"].includes(product)) throw new Error("Choose roomwise or aisle.");
  if (!url) url = await ask(`Link to the ${product} demo video: `);
  let u; try { u = new URL(url); } catch { throw new Error("That is not a web address. Paste the full link, starting with https://"); }
  if (u.protocol !== "https:") throw new Error("The link must start with https://");
  if (u.username || u.password) throw new Error("The link must not contain a username or password.");

  if (check) {
    // Reviewers open this link signed out. A link that sends them to a sign-in page will fail review.
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (link check)" } });
      const final = new URL(res.url);
      if (res.status >= 400) throw new Error(`The link answers HTTP ${res.status}. Check the address and that sharing is on.`);
      if (/(^|\.)accounts\.google\.com$|\/(login|signin|sign-in)\b/i.test(final.hostname + final.pathname)) throw new Error(`The link sends visitors to a sign-in page (${final.hostname}). Change sharing to "anyone with the link" and try again.`);
    } catch (e) {
      if (e.message.startsWith("The link")) throw e;
      console.warn(`Could not check the link from here (${e.cause?.code ?? e.message}). Saving it anyway; open it in a private window to be sure it plays without signing in.`);
    }
  }
  saveDemoUrl(product, url);
  console.log(`\nSaved the ${product} demo video link.\nNext: npm run package:plugins   then upload the new ZIP from your Downloads folder.`);
} catch (e) { console.error(e.message); process.exit(1); }

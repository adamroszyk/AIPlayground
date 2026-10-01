// Save, show or forget your Cloudflare credentials.  npm run credentials [-- --show | --forget]
import { ask, looksLikeAccountId, looksLikeToken } from "./cloudflare/prompt.mjs";
import { forgetCredentials, loadCredentials, pickBackend, saveCredentials, verifyToken } from "./cloudflare/credentials.mjs";
import { missingPermissions } from "./cloudflare/cf.mjs";

const flag = process.argv[2];
const backend = pickBackend();

if (flag === "--forget") { forgetCredentials({ backend }); console.log(`Removed the saved Cloudflare credentials from ${backend.name}. (The token itself stays valid until you delete it in the dashboard.)`); process.exit(0); }

if (flag === "--show") {
  const c = loadCredentials({ backend });
  if (!c) { console.log("Nothing saved. Run: npm run credentials"); process.exit(0); }
  const v = await verifyToken({ token: c.token, accountId: c.accountId });
  console.log(`Account ID : ${c.accountId}\nToken      : saved in ${c.backend} (${c.token.slice(0, 4)}...${c.token.slice(-4)}), saved ${c.savedAt}\nStatus     : ${v.ok ? `active${v.expiresOn ? `, expires ${v.expiresOn}` : ", no expiry"}` : (v.unreachable ? "could not be checked (no connection to Cloudflare)" : `NOT usable: ${v.reason}. Create a new token and run: npm run credentials`)}`);
  process.exit(0);
}

try {
  console.log(`Your token will be stored in ${backend.name}, never in the repository.\n`);
  let accountId = "";
  for (let i = 0; i < 3 && !looksLikeAccountId(accountId); i++) accountId = await ask("Cloudflare account ID (32 letters and digits, from the dashboard address): ");
  if (!looksLikeAccountId(accountId)) throw new Error("That is not a 32-character account ID.");
  let token = "";
  for (let i = 0; i < 3 && !looksLikeToken(token); i++) token = await ask("Cloudflare API token (typing is hidden): ", { hidden: true });
  if (!looksLikeToken(token)) throw new Error("That does not look like an API token. Paste the real value, not a placeholder.");

  const v = await verifyToken({ token, accountId });
  if (!v.ok && !v.unreachable) throw new Error(`Not saved: ${v.reason}.`);
  if (v.unreachable) console.warn("Could not reach Cloudflare to check the token; saving it anyway.");
  else {
    console.log(`Token is active${v.expiresOn ? `, expires ${v.expiresOn}` : " (no expiry set)"}.`);
    const { missing } = await missingPermissions({ token, account: accountId });
    if (missing.length) { console.error(`\nNot saved: this token lacks ${missing.join(", ")}. Create one with Workers Scripts: Edit, Workers KV Storage: Edit, D1: Edit, Account Settings: Read.`); process.exit(1); }
  }
  const where = saveCredentials({ token, accountId, backend });
  console.log(`\nSaved in ${where}. 'npm run deploy' will use it automatically. See it with: npm run credentials -- --show   Remove it with: npm run credentials -- --forget`);
} catch (e) { console.error(e.message); process.exit(1); }

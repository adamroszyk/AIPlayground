// Post-deploy smoke test. Works against any base URL, including a local `wrangler dev`.
//   node scripts/smoke.mjs <https://host> <home|wedding> [--challenge=<token>] [--waitlist]
// Creates one plan through the real MCP tool, reads it back, and deletes it again.
const [base0, app, ...rest] = process.argv.slice(2);
if (!base0 || !["home", "wedding"].includes(app)) { console.error("usage: node scripts/smoke.mjs <base-url> <home|wedding> [--challenge=token]"); process.exit(2); }
const base = base0.replace(/\/$/, "");
const challenge = rest.find((a) => a.startsWith("--challenge="))?.slice(12);
const { fixtures } = await import(`../apps/${app}/plugin/fixtures.ts`);
const { spec } = await import(`../apps/${app}/plugin/spec.ts`);

const waitSeconds = Number((rest.find((a) => a.startsWith("--wait=")) ?? "").slice(7)) || 0;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const get = (p, init) => fetch(base + p, { redirect: "manual", ...init });

// 0. A brand-new workers.dev address can take a minute or two to start answering. Wait for the Worker itself (the CORS preflight is
//    answered by our code, not by static files), and say plainly if it never does.
if (waitSeconds) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t0 = Date.now();
  let last = "no answer yet", live = false, nextNote = 0;
  while (Date.now() - t0 < waitSeconds * 1000) {
    try { const r = await fetch(`${base}/mcp`, { method: "OPTIONS" }); if (r.status === 204) { live = true; break; } last = `HTTP ${r.status}`; } catch (e) { last = String(e.cause?.code ?? e.message); }
    if (Date.now() - t0 >= nextNote) { console.log(`waiting for ${base} to start answering (${last})...`); nextNote += 15000; }
    await sleep(5000);
  }
  if (!live) {
    console.error(`\nThe Worker is still not answering after ${waitSeconds} s (last result: ${last}).\nThis is not a failure of the app's checks: the request is not reaching it. Things to check:\n  1. Open ${base}/ in a browser.\n  2. Cloudflare dashboard > Workers & Pages > ${new URL(base).hostname.split(".")[0]} > Settings > Domains & Routes: the workers.dev route must be enabled.\n  3. Run: curl -i -X OPTIONS ${base}/mcp   (a working Worker answers 204 with access-control headers)\nThen rerun: node scripts/smoke.mjs ${base} ${app}`);
    process.exit(1);
  }
  console.log(`${base} is answering after ${Math.round((Date.now() - t0) / 1000)} s`);
}

// 1. site, legal pages, editor shell, headers
for (const p of ["/", "/privacy/", "/terms/", "/support/", "/app/", "/robots.txt", "/sitemap.xml", "/favicon.svg"]) {
  const r = await get(p); ok(r.status === 200, `GET ${p} -> ${r.status}`);
}
const home = await get("/");
ok(/content-security-policy/i.test([...home.headers.keys()].join(",")) && /frame-ancestors|default-src/.test(home.headers.get("content-security-policy") ?? ""), "landing page sends a Content-Security-Policy");
ok((await (await get("/privacy/")).text()).includes(spec.displayName), "privacy page names the product");
ok((await get("/nope-" + Date.now())).status === 404, "unknown path is 404");

// 2. domain verification
const ch = await get("/.well-known/openai-apps-challenge");
if (challenge) ok(ch.status === 200 && (await ch.text()) === challenge && /^text\/plain/.test(ch.headers.get("content-type") ?? ""), "challenge route returns exactly the token as text/plain");
else ok(ch.status === 404, "challenge route is 404 until a token is configured (pass --challenge=TOKEN to verify it)");

// 3. MCP
const opt = await get("/mcp", { method: "OPTIONS" });
ok(opt.status === 204 && opt.headers.get("access-control-allow-origin") === "*", "OPTIONS /mcp answers CORS preflight");
let n = 0;
const rpc = async (method, params = {}) => {
  const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) });
  const raw = await res.text();
  const body = raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data:"))?.slice(5);
  if (!body) throw new Error(`${method}: HTTP ${res.status} ${raw.slice(0, 200)}`);
  return JSON.parse(body);
};
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
ok(init.result?.serverInfo?.name === spec.server, `initialize -> ${init.result?.serverInfo?.name}`);
const tools = (await rpc("tools/list")).result.tools;
ok(tools.length === 3, `tools/list -> ${tools.map((t) => t.name).join(", ")}`);

// 4. every review case, end to end; remember any plan it saved so it can be deleted
const created = [];
for (const [i, f] of fixtures.entries()) {
  const t0 = Date.now();
  const r = (await rpc("tools/call", { name: f.tool, arguments: f.args })).result;
  const problem = f.check(r);
  ok(problem === null, `review case ${i + 1} (${f.tool}) in ${Date.now() - t0} ms${problem ? `: ${problem}` : ""}`);
  if (r.structuredContent?.editUrl) created.push(r.structuredContent.editUrl);
}

// 5. saved plans: links point at this host, the plan reads back, the editor shell loads, and delete works
ok(created.length > 0, "a review case saved a plan");
for (const edit of created) {
  ok(edit.startsWith(base + "/p/"), `edit link uses this host (${edit.replace(/#k=.*/, "#k=…").slice(0, 80)})`);
  const id = new URL(edit).pathname.split("/").pop(), token = edit.split("#k=")[1];
  const g = await get(`/api/plans/${id}`);
  ok(g.status === 200 && !JSON.stringify(await g.json()).includes(token), "GET plan works and does not expose the manage token");
  const shell = await get(`/p/${id}`);
  ok(shell.status === 200 && /id="app"/.test(await shell.text()), "/p/<id> serves the editor shell");
  ok((await get(`/api/plans/${id}`, { method: "DELETE" })).status === 403, "DELETE without the token is refused");
  ok((await get(`/api/plans/${id}`, { method: "DELETE", headers: { "x-manage-token": token } })).status === 200, "DELETE with the token works");
  ok((await get(`/api/plans/${id}`)).status === 404, "deleted plan is gone");
}

// 5b. waitlist (opt-in: it writes a real record)
if (rest.includes("--waitlist")) {
  const wl = await get("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "smoke-test@invalid.example" }) });
  ok(wl.status === 200, `waitlist accepts a signup -> ${wl.status} (stored as smoke-test@invalid.example)`);
}
ok((await get("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 400, "waitlist rejects a missing email");

console.log(fails ? `\n${fails} FAILED` : "\nSMOKE PASSED");
process.exit(fails ? 1 : 0);

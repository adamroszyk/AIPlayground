import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3917;
const URL_ = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess;
let id = 0;

async function rpc(method: string, params: unknown = {}) {
  const res = await fetch(`${URL_}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  assert.equal(res.status, 200, `${method} -> HTTP ${res.status}`);
  const raw = await res.text();
  // Responses may be plain JSON or a single SSE "data:" event.
  const json = raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data:"))!.slice(5);
  return JSON.parse(json);
}
const call = async (name: string, args: unknown) => (await rpc("tools/call", { name, arguments: args })).result;

before(async () => {
  proc = spawn(process.execPath, ["src/server/index.ts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "pipe" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${URL_}/healthz`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});
after(() => proc.kill());

test("initialize + list tools: every tool has a title and a read-only/destructive annotation", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(init.result.serverInfo.name, "toolbox");
  const { tools } = (await rpc("tools/list")).result;
  assert.deepEqual(tools.map((t: any) => t.name).sort(), ["calculate_age", "calculate_loan_payment", "count_text", "create_qr_code", "date_math", "generate_password"]);
  for (const t of tools) {
    assert.ok(t.title, `${t.name} missing title`);
    assert.ok(t.annotations?.readOnlyHint !== undefined || t.annotations?.destructiveHint !== undefined, `${t.name} missing annotation`);
    assert.ok(t.description.length > 30, `${t.name} description too thin`);
  }
  const qr = tools.find((t: any) => t.name === "create_qr_code");
  assert.equal(qr._meta.ui.resourceUri, "ui://toolbox/qr.html");
});

test("create_qr_code returns a real PNG and a widget resource exists", async () => {
  const r = await call("create_qr_code", { text: "https://example.com" });
  const img = r.content.find((c: any) => c.type === "image");
  assert.deepEqual([...Buffer.from(img.data, "base64").subarray(1, 4)], [0x50, 0x4e, 0x47]);
  const res = await rpc("resources/read", { uri: "ui://toolbox/qr.html" });
  assert.match(res.result.contents[0].mimeType, /html/);
  assert.match(res.result.contents[0].text, /<div id="root">/);
});

test("count_text, generate_password, calculate_age, date_math, calculate_loan_payment", async () => {
  assert.equal((await call("count_text", { text: "one two three" })).structuredContent.words, 3);
  const pw = await call("generate_password", { length: 20 });
  assert.equal(pw.structuredContent.password.length, 20);
  assert.equal((await call("calculate_age", { birthDate: "1990-05-15", asOf: "2025-03-10" })).structuredContent.years, 34);
  assert.equal((await call("date_math", { from: "2024-02-28", addDays: 2 })).structuredContent.result, "2024-03-01");
  const loan = await call("calculate_loan_payment", { principal: 300000, annualRatePercent: 6.5, years: 30 });
  assert.equal(loan.structuredContent.monthlyPrincipalAndInterest, 1896.2);
});

test("bad input comes back as a tool error the model can read, not a crash", async () => {
  const r = await call("calculate_age", { birthDate: "2025-02-30" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /real calendar date/);
  const r2 = await call("date_math", { from: "2025-01-01" });
  assert.equal(r2.isError, true);
});

test("non-POST and unknown paths are rejected cleanly", async () => {
  assert.equal((await fetch(`${URL_}/mcp`)).status, 405);
  assert.equal((await fetch(`${URL_}/nope`)).status, 404);
});

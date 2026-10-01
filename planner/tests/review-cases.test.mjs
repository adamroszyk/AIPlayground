// Runs every draft review test case against the real servers on workerd, and checks tool schemas against the approved snapshot.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startWorker, mcpClient } from "./helpers.mjs";
import { compareTools } from "../packages/plugin-kit/src/index.ts";

const products = [
  { dir: "home", port: 8803, insp: 9403 },
  { dir: "wedding", port: 8804, insp: 9404 },
];
const workers = new Map();
before(async () => { for (const p of products) { const w = startWorker(`apps/${p.dir}`, p.port, p.insp); workers.set(p.dir, w); } await Promise.all([...workers.values()].map((w) => w.ready())); });
after(() => workers.forEach((w) => w.stop()));

for (const p of products) {
  const load = async () => ({ ...(await import(`../apps/${p.dir}/plugin/spec.ts`)), ...(await import(`../apps/${p.dir}/plugin/fixtures.ts`)) });

  test(`${p.dir}: five positive cases each have a fixture that calls the named tool and passes`, async () => {
    const { spec, fixtures } = await load();
    assert.equal(spec.cases.positive.length, 5);
    assert.equal(fixtures.length, 5);
    const { call } = mcpClient(workers.get(p.dir).base);
    for (const [i, c] of spec.cases.positive.entries()) {
      const f = fixtures[i];
      assert.equal(c.tools_triggered, f.tool, `case ${i + 1} ("${c.description}") names ${c.tools_triggered} but its fixture calls ${f.tool}`);
      const t0 = Date.now();
      const r = await call(f.tool, f.args);
      const problem = f.check(r);
      assert.equal(problem, null, `case ${i + 1} "${c.description}": ${problem}`);
      assert.ok(Date.now() - t0 < 5000, `case ${i + 1} took ${Date.now() - t0} ms`);
    }
  });

  test(`${p.dir}: negative cases are excluded in the tool descriptions, and listed prompts are unique`, async () => {
    const { spec } = await load();
    assert.equal(spec.cases.negative.length, 3);
    const { rpc } = mcpClient(workers.get(p.dir).base);
    const tools = (await rpc("tools/list")).result.tools;
    const planner = tools.find((t) => /^plan_/.test(t.name));
    assert.match(planner.description, /do not use|does not/i, "the main tool says what it must not be used for");
    const prompts = [...spec.cases.positive, ...spec.cases.negative].map((c) => c.prompt);
    assert.equal(new Set(prompts).size, 8);
    for (const c of spec.cases.positive) assert.ok(c.expected_behavior.length > 20 && c.description.length > 5);
  });

  test(`${p.dir}: tool schemas are compatible with the approved snapshot`, async () => {
    const approved = JSON.parse(await readFile(`apps/${p.dir}/plugin/tools.snapshot.json`, "utf8"));
    const live = (await mcpClient(workers.get(p.dir).base).rpc("tools/list")).result.tools;
    const r = compareTools(approved, live);
    assert.deepEqual(r.breaking, [], "breaking tool change: " + r.breaking.join("; "));
    assert.deepEqual(r.held, [], "this change would be held for OpenAI review: " + r.held.join("; "));
  });

  test(`${p.dir}: tool descriptions follow OpenAI's metadata guidance (start with "Use this when", say when not to use it)`, async () => {
    const tools = (await mcpClient(workers.get(p.dir).base).rpc("tools/list")).result.tools;
    for (const t of tools) {
      assert.match(t.description, /^Use this when/, `${t.name} should start with "Use this when"`);
      assert.match(t.description, /Do not use/, `${t.name} should say when not to use it`);
      assert.ok(t.description.length <= 1200, `${t.name} description is ${t.description.length} characters`);
      assert.doesNotMatch(t.description, /\b(best|free|cheap|guarantee[sd]?)\b/i, `${t.name} makes no unverifiable or pricing claims`);
    }
  });

  test(`${p.dir}: every tool has the metadata OpenAI reviews`, async () => {
    const tools = (await mcpClient(workers.get(p.dir).base).rpc("tools/list")).result.tools;
    assert.equal(tools.length, 3);
    for (const t of tools) {
      assert.ok(t.title && t.description.length >= 120, `${t.name} title/description`);
      for (const h of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) assert.equal(typeof t.annotations?.[h], "boolean", `${t.name} ${h}`);
      assert.equal(t.annotations.openWorldHint, false, `${t.name} reaches no external systems`);
      assert.equal(t.annotations.destructiveHint, false, `${t.name} is not destructive`);
      assert.ok(t.inputSchema?.properties && Object.values(t.inputSchema.properties).every((s) => s.description || s.type === "object" || s.type === "array" || s.default !== undefined || s.enum || s.oneOf || s.anyOf), `${t.name}: every top-level parameter is described`);
    }
  });
}

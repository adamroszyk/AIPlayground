import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPluginFiles, compareTools, contrast, lintPlugin, readZip, writeZip, type PluginSpec, type ToolDef } from "./index.ts";

const spec: PluginSpec = {
  name: "demo-plugin", version: "1.0.0", description: "Demo.", keywords: ["x"], displayName: "Demo", shortDescription: "A short one", longDescription: "Long.", category: "Lifestyle",
  capabilities: ["A"], defaultPrompt: ["Do the thing.", "Do another thing."], server: "demo", glyph: "room",
  brand: { light: "#1f6f6a", dark: "#4fc1b8", darkBg: "#121716", lightBg: "#faf8f4" },
  skill: { name: "get-started", description: "How to use it.", body: "# Hi" },
  cases: {
    positive: Array.from({ length: 5 }, (_, i) => ({ description: `d${i}`, prompt: `p${i}`, tools_triggered: "tool_a", expected_behavior: "e" })),
    negative: Array.from({ length: 3 }, (_, i) => ({ description: `n${i}`, prompt: `np${i}` })),
  },
  releaseNotes: "First.",
};
const png = (w: number, h: number) => { const b = Buffer.alloc(32); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const good = () => buildPluginFiles(spec, { publisher: "Acme Ltd", email: "help@acme.dev", siteUrl: "https://demo.acme.dev", demoUrl: "https://acme.dev/demo", screenshots: [png(1280, 800)] });
const edit = (files: Map<string, Buffer>, f: (m: any) => void) => { const m = JSON.parse(files.get("plugin.json")!.toString()); f(m); files.set("plugin.json", Buffer.from(JSON.stringify(m))); return files; };
const errs = (files: Map<string, Buffer>, release = true) => lintPlugin(files, { release, toolNames: ["tool_a"] }).errors;

test("a complete package passes in release mode", () => { assert.deepEqual(errs(good()), []); });
test("placeholders are warnings in dev and errors in release", () => {
  const f = buildPluginFiles(spec, { publisher: "[Publisher name]", email: "", siteUrl: "https://demo.example.com", screenshots: [] });
  assert.equal(errs(f, false).length, 0);
  assert.ok(lintPlugin(f).warnings.length >= 3);
  assert.ok(errs(f, true).some((e) => /placeholder/.test(e)) && errs(f, true).some((e) => /demo_recording_url/.test(e)));
});
test("the ZIP round-trips byte for byte and is deterministic", () => {
  const f = good(), z = writeZip(f), back = readZip(z);
  assert.deepEqual([...back.keys()].sort(), [...f.keys()].sort());
  for (const [k, v] of f) assert.ok(back.get(k)!.equals(v), k);
  assert.ok(writeZip(f).equals(z));
  z[45] = z[45]! ^ 0xff; // inside the first file's compressed bytes
  assert.throws(() => readZip(z));
});
test("limits from the submission doc are enforced", () => {
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.displayName = "x".repeat(31); })).some((e) => /displayName.*31/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.shortDescription = "x".repeat(31); })).some((e) => /shortDescription/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.defaultPrompt = ["a", "b", "c", "d"]; })).some((e) => /three prompts/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.defaultPrompt = ["@Demo do it"]; })).some((e) => /@mention/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.defaultPrompt = ["x".repeat(129)]; })).some((e) => /128/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.privacyPolicyURL = "http://acme.dev/privacy"; })).some((e) => /privacyPolicyURL/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.termsOfServiceURL = "https://u:p@acme.dev/t"; })).some((e) => /termsOfServiceURL/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.brandColor = "#ffee00"; })).some((e) => /contrast/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.brandColorDark = "#222222"; })).some((e) => /contrast/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].interface.developerName = "Other"; })).some((e) => /developerName/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.name = "Bad_Name"; })).some((e) => /"name"/.test(e)));
});
test("exactly five positive and three negative cases; tools must exist", () => {
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.test_cases.positive.pop(); })).some((e) => /exactly 5/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.test_cases.negative.pop(); })).some((e) => /exactly 3/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.test_cases.positive[0].tools_triggered = "nope"; })).some((e) => /does not expose/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.test_cases.positive[1].prompt = "p0"; })).some((e) => /unique/.test(e)));
});
test("forbidden content is rejected", () => {
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.test_credentials = { user: "a" }; })).some((e) => /test_credentials/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.extensions["com.openai"].review.reviewer_instructions = "log in"; })).some((e) => /reviewer_instructions/.test(e)));
  assert.ok(errs(edit(good(), (m) => { m.apps = {}; })).some((e) => /"apps"/.test(e)));
  const hooks = good(); hooks.set("hooks/hooks.json", Buffer.from("{}")); assert.ok(errs(hooks).some((e) => /hooks/.test(e)));
  const app = good(); app.set(".app.json", Buffer.from("{}")); assert.ok(errs(app).some((e) => /App references/.test(e)));
  const secret = good(); secret.set("skills/get-started/SKILL.md", Buffer.from("---\nname: a\ndescription: b\n---\napi_key = abcdefgh12345678")); assert.ok(errs(secret).some((e) => /credential/.test(e)));
  const env = good(); env.set(".env", Buffer.from("A=1")); assert.ok(errs(env).some((e) => /credential file/.test(e)));
});
test("MCP configuration: one streamable-http server, https, no secrets in the URL", () => {
  const set = (mcp: unknown) => { const f = good(); f.set("mcp.json", Buffer.from(JSON.stringify(mcp))); return errs(f); };
  const base = { $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json" };
  assert.ok(set({ ...base, mcpServers: { a: { type: "streamable-http", url: "https://a.dev/mcp" }, b: { type: "streamable-http", url: "https://b.dev/mcp" } } }).some((e) => /exactly one/.test(e)));
  assert.ok(set({ ...base, mcpServers: { a: { type: "sse", url: "https://a.dev/mcp" } } }).some((e) => /streamable-http/.test(e)));
  assert.ok(set({ ...base, mcpServers: { a: { type: "streamable-http", url: "http://a.dev/mcp" } } }).some((e) => /HTTPS/.test(e)));
  assert.ok(set({ ...base, mcpServers: { a: { type: "streamable-http", url: "https://a.dev/mcp?token=abc" } } }).some((e) => /query/.test(e)));
  assert.ok(set({ ...base, mcpServers: { a: { type: "streamable-http", url: "https://a.dev/mcp", headers: { Authorization: "x" } } } }).some((e) => /headers/.test(e)));
  const none = good(); none.delete("mcp.json"); assert.ok(errs(none).some((e) => /Missing mcp.json/.test(e)));
});
test("images: referenced files must exist and be square and at least 48 px", () => {
  const f = good(); f.delete("assets/logo.svg"); assert.ok(errs(f).some((e) => /not in the package/.test(e)));
  const g = good(); g.set("assets/logo.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>')); assert.ok(errs(g).some((e) => /square/.test(e)));
  const h = good(); h.set("assets/logo.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>')); assert.ok(errs(h).some((e) => /48x48/.test(e)));
  const i = good(); i.set("assets/screenshot-1.png", Buffer.from("not a png at all, just text bytes....")); assert.ok(errs(i).some((e) => /valid PNG/.test(e)));
  const j = good(); j.set("assets/screenshot-1.png", png(5000, 100)); assert.ok(errs(j).some((e) => /4096/.test(e)));
});
test("the skill needs front matter; plugin.json must be at the ZIP root", () => {
  const f = good(); f.set("skills/get-started/SKILL.md", Buffer.from("# no front matter")); assert.ok(errs(f).some((e) => /front matter/.test(e)));
  const nested = new Map([...good()].map(([k, v]) => [`demo/${k}`, v])); assert.ok(errs(nested).some((e) => /root of the ZIP/.test(e)));
});
test("contrast helper matches known values", () => { assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01); assert.ok(Math.abs(contrast("#777777", "#ffffff") - 4.48) < 0.05); });

const tool = (over: Partial<ToolDef> = {}): ToolDef => ({
  name: "t", title: "T", description: "D", annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { a: { type: "number", minimum: 1, maximum: 10 }, kind: { type: "string", enum: ["x", "y"] }, list: { type: "array", items: { type: "object", properties: { n: { type: "string" } }, required: ["n"] } } }, required: ["a"] }, ...over,
});
test("compat: additive optional changes are fine, breaking changes are named", () => {
  const old = [tool()];
  const clone = () => JSON.parse(JSON.stringify(old[0]));
  const add = clone(); add.inputSchema.properties.extra = { type: "string" }; add.inputSchema.properties.kind.enum.push("z"); add.inputSchema.properties.a.maximum = 20;
  assert.deepEqual(compareTools(old, [add]), { breaking: [], held: [] });
  const bad = clone(); bad.inputSchema.required.push("kind"); assert.ok(compareTools(old, [bad]).breaking.some((m) => /kind: became required/.test(m)));
  const bad2 = clone(); delete bad2.inputSchema.properties.a; assert.ok(compareTools(old, [bad2]).breaking.some((m) => /t\.a: removed/.test(m)));
  const bad3 = clone(); bad3.inputSchema.properties.kind.enum = ["x"]; assert.ok(compareTools(old, [bad3]).breaking.some((m) => /enum/.test(m)));
  const bad4 = clone(); bad4.inputSchema.properties.a.maximum = 5; assert.ok(compareTools(old, [bad4]).breaking.some((m) => /maximum lowered/.test(m)));
  const bad5 = clone(); bad5.inputSchema.properties.a.type = "string"; assert.ok(compareTools(old, [bad5]).breaking.some((m) => /type changed/.test(m)));
  const bad6 = clone(); bad6.inputSchema.properties.list.items.required.push("m"); assert.ok(compareTools(old, [bad6]).breaking.some((m) => /became required/.test(m)));
  const bad7 = clone(); bad7.annotations.readOnlyHint = false; assert.ok(compareTools(old, [bad7]).breaking.some((m) => /readOnlyHint/.test(m)));
  assert.ok(compareTools(old, []).breaking.some((m) => /removed or renamed/.test(m)));
  const desc = clone(); desc.description = "changed"; const r = compareTools(old, [desc, tool({ name: "new" })]);
  assert.deepEqual(r.breaking, []); assert.equal(r.held.length, 2);
});
test("compat: union variants must remain accepted", () => {
  const u = (types: string[]): ToolDef => tool({ inputSchema: { type: "object", properties: { rule: { oneOf: types.map((t) => ({ type: "object", properties: { type: { const: t, type: "string" } }, required: ["type"] })) } } } });
  assert.deepEqual(compareTools([u(["a", "b"])], [u(["a", "b", "c"])]).breaking, []);
  assert.ok(compareTools([u(["a", "b"])], [u(["a"])]).breaking.some((m) => /no longer accepted/.test(m)));
});

// Aisle end-to-end: runs the Worker on workerd (with local D1) and talks to it over HTTP like ChatGPT would.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startWorker, mcpClient } from "./helpers.mjs";

const w = startWorker("apps/wedding", 8792, 9392);
const { rpc, call } = mcpClient(w.base);
before(async () => { await w.ready(); });
after(() => w.stop());

const names = ["Ana Garcia", "Ben Garcia", "Cy Lee", "Di Park", "Eli Park", "Fay Kim", "Gus Roe", "Hal Fox", "Ivy Fox", "Jo Wu", "Kai Wu", "Lu Tan"];
const base = {
  guests: names.map((n, i) => ({ name: n, group: i < 3 ? "Bride's family" : i < 7 ? "College" : "Work", ...(n.endsWith("Garcia") ? { party: "Garcia" } : n.endsWith("Park") ? { party: "Park" } : {}) })),
  tables: [{ name: "Head table", seats: 4, head: true }, { seats: 4, count: 2 }],
  rules: [{ type: "apart", a: "Cy Lee", b: "Di Park" }, { type: "together", guests: ["Hal Fox", "Ivy Fox"] }, { type: "head_table", guests: ["Ana Garcia", "Ben Garcia"] }, { type: "fixed", guest: "Lu Tan", table: "Table 2" }],
};

test("initialize and list tools: titles, annotations, descriptions, widget link", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } });
  assert.equal(init.result.serverInfo.name, "aisle");
  const { tools } = (await rpc("tools/list")).result;
  assert.deepEqual(tools.map((t) => t.name).sort(), ["build_wedding_timeline", "check_wedding_seating", "plan_wedding_seating"]);
  for (const t of tools) {
    assert.ok(t.title && t.annotations?.title, `${t.name} title`);
    assert.ok(t.annotations.readOnlyHint !== undefined && t.annotations.destructiveHint !== undefined, `${t.name} annotations`);
    assert.ok(t.description.length > 120, `${t.name} description`);
  }
  assert.equal(tools.find((t) => t.name === "plan_wedding_seating").annotations.readOnlyHint, false);
  assert.equal(tools.find((t) => t.name === "plan_wedding_seating")._meta.ui.resourceUri, "ui://aisle/seating.html");
  assert.match((await rpc("resources/read", { uri: "ui://aisle/seating.html" })).result.contents[0].text, /<div id="root">/);
});

test("plan_wedding_seating solves, honours every rule, saves, and the links work", async () => {
  const r = await call("plan_wedding_seating", base);
  assert.ok(!r.isError, r.content?.[0]?.text);
  const s = r.structuredContent;
  assert.equal(s.status, "solved");
  assert.equal(s.report.ok, true);
  const tableOf = (name) => s.assignment[s.guests.find((g) => g.name === name).id];
  assert.notEqual(tableOf("Cy Lee"), tableOf("Di Park"));
  assert.equal(tableOf("Hal Fox"), tableOf("Ivy Fox"));
  assert.equal(tableOf("Ana Garcia"), "t1");
  assert.equal(tableOf("Ben Garcia"), "t1");
  assert.equal(tableOf("Lu Tan"), "t3"); // "Table 2" is the third table (after the head table)
  assert.equal(tableOf("Eli Park"), tableOf("Di Park"), "party kept together");
  assert.match(r.content[0].text, /Head table \(\d\/4\)/);
  assert.match(s.editUrl, /\/p\/[A-Za-z0-9_-]{22}#k=/);
  const got = await (await fetch(`${w.base}/api/plans/${s.planId}`)).json();
  assert.equal(got.kind, "seating");
  assert.equal(JSON.stringify(got).includes(s.editUrl.split("#k=")[1]), false);
  const token = s.editUrl.split("#k=")[1];
  assert.equal((await fetch(`${w.base}/api/plans/${s.planId}`, { method: "DELETE", headers: { "x-manage-token": token } })).status, 200);
  assert.equal((await fetch(`${w.base}/api/plans/${s.planId}`)).status, 404);
});

test("impossible rules are explained and the closest chart is returned", async () => {
  const r = await call("plan_wedding_seating", { guests: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }], tables: [{ seats: 2, count: 2 }], save: false,
    rules: [{ type: "together", guests: ["A", "B", "C"] }] });
  assert.equal(r.structuredContent.status, "infeasible");
  assert.match(r.content[0].text, /cannot all be met/i);
  assert.match(r.content[0].text, /seats 2/);
  const apart = await call("plan_wedding_seating", { guests: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }], tables: [{ seats: 2, count: 2 }], save: false,
    rules: [{ type: "apart", a: "A", b: "B" }, { type: "apart", a: "A", b: "C" }, { type: "apart", a: "B", b: "C" }] });
  assert.equal(apart.structuredContent.status, "infeasible");
  assert.match(apart.content[0].text, /cannot all hold together/);
});

test("check_wedding_seating verifies a given arrangement", async () => {
  const args = { guests: [{ name: "A" }, { name: "B" }, { name: "C" }], tables: [{ seats: 2, count: 2 }], rules: [{ type: "apart", a: "A", b: "B" }] };
  const bad = await call("check_wedding_seating", { ...args, arrangement: [{ table: "Table 1", guests: ["A", "B"] }, { table: "Table 2", guests: ["C"] }] });
  assert.equal(bad.structuredContent.report.ok, false);
  assert.match(bad.content[0].text, /FAIL: Keep apart: A and B/);
  const good = await call("check_wedding_seating", { ...args, arrangement: [{ table: "Table 1", guests: ["A", "C"] }, { table: "Table 2", guests: ["B"] }] });
  assert.equal(good.structuredContent.report.ok, true);
  const missing = await call("check_wedding_seating", { ...args, arrangement: [{ table: "Table 1", guests: ["A"] }] });
  assert.equal(missing.structuredContent.report.ok, false, "unseated guests are reported");
});

test("build_wedding_timeline matches the engine and warns about the curfew", async () => {
  const r = await call("build_wedding_timeline", { ceremonyStart: "16:00", venueCurfew: "23:00" });
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.equal(r.structuredContent.endTime, "23:15");
  assert.match(r.content[0].text, /16:00-16:30\s+Ceremony/);
  assert.match(r.content[0].text, /Warning: .*15 minutes after the 23:00 curfew/);
});

test("bad input gives readable errors", async () => {
  const dup = await call("plan_wedding_seating", { guests: [{ name: "Sam" }, { name: "sam" }], tables: [{ seats: 4 }], save: false });
  assert.equal(dup.isError, true);
  assert.match(dup.content[0].text, /share the name/);
  const unknown = await call("plan_wedding_seating", { guests: [{ name: "A" }], tables: [{ seats: 4 }], rules: [{ type: "apart", a: "A", b: "Zed" }], save: false });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /"Zed", who is not on the guest list/);
  const badTable = await call("plan_wedding_seating", { guests: [{ name: "A" }], tables: [{ seats: 4 }], rules: [{ type: "fixed", guest: "A", table: "Table 9" }], save: false });
  assert.equal(badTable.isError, true);
  assert.match(badTable.content[0].text, /Tables are: Table 1/);
  const time = await call("build_wedding_timeline", { ceremonyStart: "4pm" });
  assert.equal(time.isError, true);
  assert.match(time.content[0].text, /24-hour/);
});

test("a realistic reception: 120 guests, 14 tables, mixed rules, solved quickly", async () => {
  const guests = Array.from({ length: 120 }, (_, i) => ({ name: `Guest ${i + 1}`, group: `Group ${i % 14}`, ...(i % 6 === 0 ? { party: `P${Math.floor(i / 6)}` } : {}) }));
  const rules = [{ type: "apart", a: "Guest 3", b: "Guest 4" }, { type: "apart", a: "Guest 10", b: "Guest 11" }, { type: "together", group: "Group 2" }];
  const t0 = Date.now();
  const r = await call("plan_wedding_seating", { guests, tables: [{ seats: 10, count: 14 }], rules, save: false });
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.equal(r.structuredContent.status, "solved", r.content[0].text.slice(0, 400));
  assert.ok(Date.now() - t0 < 8000, `took ${Date.now() - t0} ms`);
});

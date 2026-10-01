// Roomwise end-to-end: runs the Worker on workerd (with local D1) and talks to it over HTTP like ChatGPT would.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startWorker, mcpClient } from "./helpers.mjs";

const w = startWorker("apps/home", 8791, 9391);
const { rpc, call } = mcpClient(w.base);
before(async () => { await w.ready(); });
after(() => w.stop());

const living = { unit: "in", room: { width: 168, length: 144, doors: [{ wall: "south", offset: 96, width: 32 }], windows: [{ wall: "north", offset: 54, width: 60 }] },
  furniture: [{ name: "Sofa", kind: "sofa", width: 84, depth: 36 }, { name: "Coffee table", kind: "coffee_table", width: 40, depth: 20 }, { name: "Armchair", kind: "chair", width: 32, depth: 32 }, { name: "TV unit", kind: "tv", width: 60, depth: 16 }, { name: "Side table", kind: "side_table", width: 18, depth: 18 }] };

test("initialize and list tools: titles, annotations, descriptions, widget link", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } });
  assert.equal(init.result.serverInfo.name, "roomwise");
  const { tools } = (await rpc("tools/list")).result;
  assert.deepEqual(tools.map((t) => t.name).sort(), ["check_room_layout", "estimate_room_materials", "plan_room_layout"]);
  for (const t of tools) {
    assert.ok(t.title && t.annotations?.title, `${t.name} title`);
    assert.ok(t.annotations.readOnlyHint !== undefined && t.annotations.destructiveHint !== undefined, `${t.name} annotations`);
    assert.ok(t.description.length > 120, `${t.name} description`);
  }
  assert.equal(tools.find((t) => t.name === "plan_room_layout").annotations.readOnlyHint, false);
  assert.equal(tools.find((t) => t.name === "check_room_layout").annotations.readOnlyHint, true);
  assert.equal(tools.find((t) => t.name === "plan_room_layout")._meta.ui.resourceUri, "ui://roomwise/plan.html");
  const res = await rpc("resources/read", { uri: "ui://roomwise/plan.html" });
  assert.match(res.result.contents[0].mimeType, /html/);
  assert.match(res.result.contents[0].text, /<div id="root">/);
});

test("plan_room_layout solves the living room, saves it, and the links work", async () => {
  const r = await call("plan_room_layout", living);
  assert.ok(!r.isError, r.content?.[0]?.text);
  const s = r.structuredContent;
  assert.equal(s.status, "solved");
  assert.equal(s.report.ok, true);
  assert.equal(s.room.width, 168);
  assert.equal(s.placements.length, 5);
  assert.match(r.content[0].text, /7 of 7 checks passed/);
  assert.match(s.editUrl, /\/p\/[A-Za-z0-9_-]{22}#k=[A-Za-z0-9_-]+$/);
  assert.equal(s.viewUrl, s.editUrl.split("#")[0]);
  const id = s.planId;
  const got = await (await fetch(`${w.base}/api/plans/${id}`)).json();
  assert.equal(got.kind, "room");
  assert.deepEqual(got.data.placements, s.placements);
  assert.equal(JSON.stringify(got).includes(s.editUrl.split("#k=")[1]), false, "the manage token is not exposed by GET");
  const token = s.editUrl.split("#k=")[1];
  const edited = { ...got.data, placements: got.data.placements.map((p, i) => (i === 0 ? { ...p, x: p.x + 2 } : p)) };
  assert.equal((await fetch(`${w.base}/api/plans/${id}`, { method: "PUT", body: JSON.stringify({ data: edited }) })).status, 403, "no token");
  assert.equal((await fetch(`${w.base}/api/plans/${id}`, { method: "PUT", headers: { "x-manage-token": token }, body: JSON.stringify({ data: edited }) })).status, 200);
  assert.equal((await (await fetch(`${w.base}/api/plans/${id}`)).json()).data.placements[0].x, edited.placements[0].x);
  assert.equal((await fetch(`${w.base}/api/plans/${id}`, { method: "PUT", headers: { "x-manage-token": token }, body: JSON.stringify({ data: { v: 1 } }) })).status, 400, "invalid plan data is rejected");
  assert.equal((await fetch(`${w.base}/api/plans/${id}`, { method: "DELETE" })).status, 403);
  assert.equal((await fetch(`${w.base}/api/plans/${id}`, { method: "DELETE", headers: { "x-manage-token": token } })).status, 200);
  assert.equal((await fetch(`${w.base}/api/plans/${id}`)).status, 404);
});

test("units are converted: 14 x 12 ft equals 168 x 144 in", async () => {
  const r = await call("plan_room_layout", { unit: "ft", save: false, room: { width: 14, length: 12, doors: [{ wall: "south", offset: 8, width: 2.67 }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 7, depth: 3 }] });
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.equal(r.structuredContent.room.width, 168);
  assert.equal(r.structuredContent.room.length, 144);
  assert.equal(r.structuredContent.planId, undefined, "save:false returns no links");
  assert.match(r.content[0].text, /Plan not saved/);
});

test("check_room_layout reports measured values for a deliberate violation", async () => {
  const args = { unit: "in", room: { width: 200, length: 200, doors: [{ wall: "south", offset: 150, width: 32 }] },
    furniture: [{ name: "Sofa", kind: "sofa", width: 80, depth: 36, x: 60, y: 20, facing: "south" }, { name: "Table", kind: "coffee_table", width: 40, depth: 20, x: 80, y: 62, facing: "south" }] };
  const bad = await call("check_room_layout", args);
  const gap = bad.structuredContent.report.results.find((x) => x.id === "sofa-table-gap");
  assert.equal(gap.ok, false);
  assert.match(gap.detail, /6 in/);
  const good = await call("check_room_layout", { ...args, furniture: [args.furniture[0], { ...args.furniture[1], y: 72 }] });
  assert.equal(good.structuredContent.report.results.find((x) => x.id === "sofa-table-gap").ok, true);
});

test("estimate_room_materials matches the hand calculation", async () => {
  const r = await call("estimate_room_materials", { unit: "ft", ceilingHeight: 8, room: { width: 14, length: 12, doors: [{ wall: "south", offset: 8, width: 2.6667 }], windows: [{ wall: "north", offset: 4.5, width: 5 }] }, paint: { pricePerGallon: 40 }, flooring: { pricePerSqFt: 3 } });
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.equal(r.structuredContent.floorAreaSqFt, 168);
  assert.equal(r.structuredContent.paintGallonsToBuy, 3);
  assert.ok(Math.abs(r.structuredContent.wallAreaSqFt - 378.2) < 0.2, `wall area ${r.structuredContent.wallAreaSqFt}`);
  assert.equal(r.structuredContent.costs.paint, 120);
});

test("bad input comes back as readable tool errors, never a crash", async () => {
  const huge = await call("plan_room_layout", { ...living, furniture: [{ name: "Giant sofa", kind: "sofa", width: 400, depth: 36 }] });
  assert.equal(huge.isError, true);
  assert.match(huge.content[0].text, /Giant sofa|between 6 in and 20 ft|longer than/);
  const wall = await call("plan_room_layout", { ...living, room: { ...living.room, doors: [{ wall: "south", offset: 150, width: 40 }] } });
  assert.equal(wall.isError, true);
  assert.match(wall.content[0].text, /does not fit on a 168 in wall/);
  const tiny = await call("plan_room_layout", { ...living, room: { width: 20, length: 20 } });
  assert.equal(tiny.isError, true);
  assert.match(tiny.content[0].text, /between 3 ft and 60 ft/);
  const invalid = await rpc("tools/call", { name: "plan_room_layout", arguments: { room: { width: -5 } } });
  assert.ok(invalid.error || invalid.result?.isError, "schema violations are rejected");
});

test("an impossible room is reported honestly, not faked", async () => {
  const r = await call("plan_room_layout", { unit: "in", save: false, room: { width: 156, length: 132, doors: [{ wall: "south", offset: 20, width: 32 }], windows: [{ wall: "north", offset: 50, width: 60 }] }, furniture: [{ name: "Dining table", kind: "dining_table", width: 72, depth: 36 }, { name: "Sideboard", kind: "storage", width: 60, depth: 18 }] });
  assert.equal(r.structuredContent.status, "partial");
  assert.equal(r.structuredContent.report.ok, false);
  assert.match(r.content[0].text, /not every check passes/);
  assert.match(r.content[0].text, /FAIL: /);
});

test("routes: challenge is 404 until configured, CORS on /mcp, unknown plan 404", async () => {
  assert.equal((await fetch(`${w.base}/.well-known/openai-apps-challenge`)).status, 404);
  const opt = await fetch(`${w.base}/mcp`, { method: "OPTIONS" });
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get("access-control-allow-origin"), "*");
  assert.equal((await fetch(`${w.base}/api/plans/abcdefghijklmnopqrstuv`)).status, 404);
  assert.equal((await fetch(`${w.base}/api/plans/..%2F..%2Fsecret`)).status, 404);
});

// For each positive review case (same order as spec.ts): the MCP call a model would make, and what must come back.
export interface Result { isError?: boolean; content: { text: string }[]; structuredContent?: any }
export interface Fixture { tool: string; args: Record<string, unknown>; check: (r: Result) => string | null }

const fail = (r: Result, re: RegExp) => (r.structuredContent?.report?.results ?? []).filter((x: any) => !x.ok && re.test(`${x.description} ${x.detail}`));
const sofaRoom = { unit: "in", room: { width: 168, length: 144, doors: [{ wall: "south", offset: 96, width: 32 }], windows: [{ wall: "north", offset: 54, width: 60 }] } };

export const fixtures: Fixture[] = [
  { tool: "plan_room_layout", args: { unit: "ft", save: true, room: { width: 14, length: 12, doors: [{ wall: "south", offset: 8, width: 2.67 }], windows: [{ wall: "north", offset: 4.5, width: 5 }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 7, depth: 3 }, { name: "Coffee table", kind: "coffee_table", width: 3.33, depth: 1.67 }, { name: "TV unit", kind: "tv", width: 5, depth: 1.33 }] },
    check: (r) => (r.structuredContent?.status !== "solved" ? `not solved: ${r.content[0]?.text.slice(0, 200)}` : r.structuredContent.placements.length !== 3 ? "not all pieces placed" : !/\/p\/[\w-]{22}#k=/.test(r.structuredContent.editUrl ?? "") ? "no edit link" : null) },
  { tool: "check_room_layout", args: { ...sofaRoom, furniture: [{ name: "Sofa", kind: "sofa", width: 84, depth: 36, x: 8, y: 90, facing: "north" }, { name: "Coffee table", kind: "coffee_table", width: 40, depth: 20, x: 30, y: 64, facing: "north" }, { name: "TV unit", kind: "tv", width: 60, depth: 16, x: 54, y: 0, facing: "south" }] },
    check: (r) => (fail(r, /coffee|gap|sofa/i).length === 0 ? `no failing sofa/coffee-table check: ${r.content[0]?.text.slice(0, 400)}` : !/\b6\b/.test(JSON.stringify(fail(r, /coffee|gap|sofa/i))) ? "failing check does not report the 6 in gap" : null) },
  { tool: "estimate_room_materials", args: { unit: "ft", ceilingHeight: 8, room: { width: 14, length: 12, doors: [{ wall: "south", offset: 8, width: 2.67 }], windows: [{ wall: "north", offset: 4.5, width: 5 }] } },
    check: (r) => (r.isError ? r.content[0]?.text ?? "error" : !/168/.test(r.content[0]!.text) ? "floor area 168 sq ft missing" : !/gal/i.test(r.content[0]!.text) ? "no paint quantity" : null) },
  { tool: "plan_room_layout", args: { unit: "ft", save: false, room: { width: 12, length: 11, doors: [{ wall: "south", offset: 4, width: 2.67 }] }, furniture: [{ name: "Dining table", kind: "dining_table", width: 5, depth: 3 }, { name: "Sideboard", kind: "storage", width: 5, depth: 1.5 }] },
    check: (r) => (r.structuredContent?.status !== "solved" ? `not solved: ${r.content[0]?.text.slice(0, 300)}` : !(r.structuredContent.report.results ?? []).some((x: any) => /dining|chair/i.test(x.description)) ? "no dining clearance check reported" : null) },
  { tool: "check_room_layout", args: { unit: "in", room: { width: 144, length: 144, doors: [{ wall: "south", offset: 48, width: 32, swing: "in" }] }, furniture: [{ name: "Sofa", kind: "sofa", width: 90, depth: 36, x: 30, y: 100, facing: "north" }] },
    check: (r) => (fail(r, /door|swing|walkway/i).length === 0 ? `no door or walkway failure: ${r.content[0]?.text.slice(0, 400)}` : null) },
];

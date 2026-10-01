export interface Result { isError?: boolean; content: { text: string }[]; structuredContent?: any }
export interface Fixture { tool: string; args: Record<string, unknown>; check: (r: Result) => string | null }

const names = Array.from({ length: 54 }, (_, i) => `Guest ${i + 1}`);
const smiths = ["Sam Smith", "Sue Smith", "Sid Smith", "Sky Smith"];
const idOf = (r: Result, name: string): string => r.structuredContent.guests.find((g: any) => g.name === name).id;
const tableOfName = (r: Result, name: string) => r.structuredContent.assignment[idOf(r, name)];

export const fixtures: Fixture[] = [
  { tool: "plan_wedding_seating", args: { save: true, guests: [...smiths, "Alex", "Jo", ...names].map((name) => ({ name })), tables: [{ seats: 8, count: 8 }], rules: [{ type: "together", guests: smiths }, { type: "apart", a: "Alex", b: "Jo" }] },
    check: (r) => (r.structuredContent?.status !== "solved" ? `not solved: ${r.content[0]?.text.slice(0, 300)}` : new Set(smiths.map((n) => tableOfName(r, n))).size !== 1 ? "Smiths are not at one table" : tableOfName(r, "Alex") === tableOfName(r, "Jo") ? "Alex and Jo share a table" : Object.keys(r.structuredContent.assignment).length !== 60 ? "not everyone is seated" : !/#k=/.test(r.structuredContent.editUrl ?? "") ? "no edit link" : null) },
  { tool: "check_wedding_seating", args: { guests: ["Ann", "Bob", "Cy", "Dee", "Eli"].map((name) => ({ name })), tables: [{ seats: 4, count: 2 }], rules: [{ type: "apart", a: "Ann", b: "Eli" }, { type: "together", guests: ["Bob", "Dee"] }], arrangement: [{ table: "Table 1", guests: ["Ann", "Bob", "Cy"] }, { table: "Table 2", guests: ["Dee", "Eli"] }] },
    check: (r) => { const res = r.structuredContent?.report?.results ?? []; const t = res.find((x: any) => /Seat together/.test(x.description)), a = res.find((x: any) => /Keep apart/.test(x.description)); return !t || t.ok ? "keep-together failure not reported" : !a || !a.ok ? "keep-apart should pass" : null; } },
  { tool: "build_wedding_timeline", args: { ceremonyStart: "16:00", travelMinutes: 20, venueCurfew: "23:00" },
    check: (r) => { const segs = r.structuredContent?.segments ?? []; return !segs.some((s: any) => /travel/i.test(s.name)) ? "no travel segment" : segs[0]?.start === undefined ? "no segments" : !(r.structuredContent.warnings ?? []).some((w: string) => /curfew/i.test(w)) ? "no curfew warning for a schedule that runs late" : null; } },
  { tool: "plan_wedding_seating", args: { save: false, guests: ["Bride", "Groom", "Bride Mum", "Bride Dad", "Groom Mum", "Groom Dad", ...Array.from({ length: 14 }, (_, i) => `Friend ${i + 1}`)].map((name) => ({ name })), tables: [{ name: "Head table", seats: 6, head: true }, { seats: 6, count: 3 }], rules: [{ type: "head_table", guests: ["Bride", "Groom", "Bride Mum", "Bride Dad", "Groom Mum", "Groom Dad"] }] },
    check: (r) => (r.structuredContent?.status !== "solved" ? `not solved: ${r.content[0]?.text.slice(0, 300)}` : !["Bride", "Groom", "Bride Mum", "Bride Dad", "Groom Mum", "Groom Dad"].every((n) => tableOfName(r, n) === "t1") ? "head table guests are not at the head table" : tableOfName(r, "Friend 1") === "t1" ? "a friend took a head table seat" : null) },
  { tool: "plan_wedding_seating", args: { save: false, guests: ["Ann", "Bob", "Cy"].map((name) => ({ name })), tables: [{ seats: 2, count: 2 }], rules: [{ type: "together", guests: ["Ann", "Bob"] }, { type: "apart", a: "Ann", b: "Bob" }] },
    check: (r) => (r.structuredContent?.status !== "infeasible" ? "should be infeasible" : !/cannot all/i.test(r.content[0]!.text) ? "conflict is not explained" : (r.structuredContent.report?.ok ? "report claims ok" : null)) },
];

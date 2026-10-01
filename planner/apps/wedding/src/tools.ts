import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { TIMELINE_DEFAULTS as D, buildTimeline, solveSeating, verifySeating, type SeatingReport } from "@planner/engine";
import { CREATES_PLAN, READ_ONLY, fail, type PlanStore } from "@planner/core";
import { buildArrangement, buildGuests, buildRules, buildTables, type SeatingPlan } from "./model.ts";
import { WIDGET_HTML } from "./widget.generated.ts";

export const SERVER_INFO = { name: "aisle", version: "1.0.0" };
const WIDGET_URI = "ui://aisle/seating.html";

const guest = z.object({
  name: z.string().min(1).max(80).describe("The guest's name as it should appear. Every name must be unique; add a last initial if two guests share a first name. First names or initials are enough."),
  group: z.string().max(60).optional().describe("A label such as 'Bride's family' or 'College friends'. The planner tries to keep a group at as few tables as possible."),
  party: z.string().max(60).optional().describe("Guests with the same party label (a couple, a family with kids) always sit at the same table."),
});
const tableSpec = z.object({
  name: z.string().max(40).optional().describe("Optional table name. Leave out to number tables automatically."),
  seats: z.number().int().min(1).max(24).describe("Seats per table."),
  count: z.number().int().min(1).max(40).optional().describe("How many identical tables (default 1)."),
  head: z.boolean().optional().describe("True for the head table, which the 'head_table' rule refers to."),
});
const rule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("together"), guests: z.array(z.string()).min(2).max(12).optional().describe("Names that must share a table."), group: z.string().optional().describe("Alternatively, a group label: everyone in it shares a table.") }),
  z.object({ type: z.literal("apart"), a: z.string(), b: z.string() }).describe("These two guests must not share a table."),
  z.object({ type: z.literal("head_table"), guests: z.array(z.string()).min(1).max(24) }).describe("These guests must sit at the head table."),
  z.object({ type: z.literal("fixed"), guest: z.string(), table: z.string().describe("The table's name, e.g. 'Table 3'.") }).describe("This guest must sit at this table."),
]);
const problem = { guests: z.array(guest).min(1).max(300), tables: z.array(tableSpec).min(1).max(40), rules: z.array(rule).max(100).optional() };

const text = (t: string, structuredContent?: Record<string, unknown>) => ({ content: [{ type: "text" as const, text: t }], ...(structuredContent ? { structuredContent } : {}) });
const reportLines = (r: SeatingReport) => r.results.map((x) => `${x.ok ? "PASS" : "FAIL"}: ${x.description}. ${x.detail}`).join("\n");

export interface ToolEnv { store: PlanStore; baseUrl: string
  /** Called before a solver runs; throws to refuse when the daily solver allowance is used up. */
  beforeSolve?: () => Promise<void>;
}

export function createServer(env: ToolEnv): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Aisle builds wedding seating charts that satisfy every rule and checks them. Use the guests' real names and the user's real rules; ask about missing table sizes instead of guessing. If the result says rules conflict, tell the user which ones and suggest relaxing one.",
  });

  registerAppTool(
    server,
    "plan_wedding_seating",
    {
      title: "Plan wedding seating",
      description:
        "Builds a wedding seating chart. Given the guest list (with optional groups and parties), the tables, and rules (keep together, keep apart, head table, fixed seat), it seats everyone, keeps parties together and groups close, and then re-checks every rule on the finished chart. Returns who sits at each table, a pass/fail report for each rule, and links to view and edit the chart on the web. If the rules cannot all be met it says which ones conflict and returns the closest chart. Use when the user wants a seating chart or to seat guests around rules. It does not send invitations or book vendors.",
      inputSchema: z.object({ ...problem, save: z.boolean().default(true).describe("Save the chart and return links to view and edit it.") }),
      annotations: { ...CREATES_PLAN, title: "Plan wedding seating" },
      _meta: { ui: { resourceUri: WIDGET_URI } },
    },
    async (args) => {
      try {
        await env.beforeSolve?.();
        const guests = buildGuests(args.guests);
        const tables = buildTables(args.tables);
        const rules = buildRules(args.rules ?? [], guests, tables);
        const res = solveSeating({ guests, tables, rules }, { seed: 1 });
        const plan: SeatingPlan = { v: 1, guests, tables, rules, assignment: res.assignment, seats: res.seats, report: res.report, status: res.status, conflicts: res.conflicts, relaxedRules: res.relaxedRules };
        let links: { planId: string; viewUrl: string; editUrl: string } | undefined;
        if (args.save) {
          const { id, manageToken } = await env.store.create("seating", plan);
          links = { planId: id, viewUrl: `${env.baseUrl}/p/${id}`, editUrl: `${env.baseUrl}/p/${id}#k=${manageToken}` };
        }
        const byId = new Map(guests.map((g) => [g.id, g]));
        const tableLines = tables.map((t) => `${t.name} (${res.seats[t.id]?.length ?? 0}/${t.capacity}): ${(res.seats[t.id] ?? []).map((id) => byId.get(id)!.name).join(", ") || "empty"}`);
        const lines = [
          res.status === "solved" ? `Seating chart ready: ${res.report.passed} of ${res.report.total} rules met.` : "These rules cannot all be met together. Here is the closest chart.",
          "",
          ...tableLines,
          "",
          reportLines(res.report),
          ...(res.conflicts.length ? ["", ...res.conflicts] : []),
          "",
          links ? `Open and adjust the chart on the web: ${links.editUrl}\nView-only link to share: ${links.viewUrl}\nCharts are deleted 90 days after the last edit.` : "Chart not saved.",
        ];
        return text(lines.join("\n"), { ...plan, ...(links ?? {}) });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "check_wedding_seating",
    {
      title: "Check a seating chart",
      description:
        "Checks a seating chart the user already has (or has edited) against their rules without changing it: capacity, everyone seated exactly once, parties together, and every keep-together, keep-apart, head-table and fixed-seat rule. Returns pass/fail with details for each. Use to answer 'does this seating work?' for a specific arrangement.",
      inputSchema: z.object({ ...problem, arrangement: z.array(z.object({ table: z.string().describe("Table name, e.g. 'Table 2'."), guests: z.array(z.string()) })).describe("Who sits at each table.") }),
      annotations: { ...READ_ONLY, title: "Check a seating chart" },
    },
    async (args) => {
      try {
        const guests = buildGuests(args.guests);
        const tables = buildTables(args.tables);
        const rules = buildRules(args.rules ?? [], guests, tables);
        const { assignment, seats } = buildArrangement(args.arrangement, guests, tables);
        const report = verifySeating({ guests, tables, rules }, assignment);
        return text(`${report.passed} of ${report.total} rules met.\n\n${reportLines(report)}`, { guests, tables, rules, assignment, seats, report });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "build_wedding_timeline",
    {
      title: "Build a wedding day timeline",
      description:
        "Builds a day-of schedule from the ceremony start time: guest arrival, ceremony, photos, optional travel between venues, cocktail hour, dinner, toasts, first dance, cake and dancing, with buffers between segments. Warns if it runs past a venue curfew or if photos run after sunset. Times are 24-hour HH:MM. Use when the user wants a wedding day schedule. Durations are in minutes and all optional.",
      inputSchema: z.object({
        ceremonyStart: z.string().describe("Ceremony start, 24-hour HH:MM, e.g. 16:00."),
        ceremonyMinutes: z.number().min(0).max(240).optional().describe(`Ceremony length in minutes (default ${D.ceremonyMinutes}).`),
        guestsArriveMinutesBefore: z.number().min(0).max(240).optional().describe(`How long before the ceremony guests start arriving (default ${D.guestsArriveMinutesBefore}).`),
        photosMinutes: z.number().min(0).max(240).optional().describe(`Photo session after the ceremony, in minutes (default ${D.photosMinutes}).`),
        travelMinutes: z.number().min(0).max(240).optional().describe("Travel between ceremony and reception venues; 0 if the same place."),
        cocktailMinutes: z.number().min(0).max(240).optional().describe(`Cocktail hour length in minutes (default ${D.cocktailMinutes}).`),
        dinnerMinutes: z.number().min(0).max(240).optional().describe(`Dinner length in minutes (default ${D.dinnerMinutes}).`),
        toastsMinutes: z.number().min(0).max(120).optional().describe(`Speeches and toasts in minutes (default ${D.toastsMinutes}).`),
        firstDanceMinutes: z.number().min(0).max(60).optional().describe(`First dance in minutes (default ${D.firstDanceMinutes}).`),
        cakeMinutes: z.number().min(0).max(60).optional().describe(`Cake cutting in minutes (default ${D.cakeMinutes}).`),
        danceMinutes: z.number().min(0).max(360).optional().describe(`Open dancing in minutes (default ${D.danceMinutes}).`),
        bufferMinutes: z.number().min(0).max(60).optional().describe(`Slack between segments in minutes (default ${D.bufferMinutes}).`),
        venueCurfew: z.string().optional().describe("Time the venue must be empty, HH:MM. Earlier than the ceremony means after midnight."),
        sunset: z.string().optional().describe("Sunset time HH:MM, to flag outdoor photos after dark."),
      }),
      annotations: { ...READ_ONLY, title: "Build a wedding day timeline" },
    },
    async (args) => {
      try {
        const t = buildTimeline(args);
        const lines = [
          ...t.segments.map((s) => `${s.start}-${s.end}${s.day ? " (next day)" : ""}  ${s.name} (${s.minutes} min)${s.note ? `. ${s.note}` : ""}`),
          "",
          `Ends at ${t.endTime}; the whole day runs ${Math.floor(t.totalMinutes / 60)} h ${t.totalMinutes % 60} min.`,
          ...(t.warnings.length ? ["", ...t.warnings.map((w) => `Warning: ${w}`)] : []),
        ];
        return text(lines.join("\n"), { ...t });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  registerAppResource(server, "Seating chart", WIDGET_URI, { description: "A seating chart with the rule checks", _meta: { ui: { prefersBorder: false } } }, async () => ({
    contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: WIDGET_HTML }],
  }));

  return server;
}

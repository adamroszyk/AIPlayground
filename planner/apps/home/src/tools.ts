import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { estimateMaterials, solveLayout, verifyLayout, type LayoutReport } from "@planner/engine";
import { CREATES_PLAN, READ_ONLY, fail, fromInches, toInches, type PlanStore, type Unit } from "@planner/core";
import { KINDS, WALLS, buildPieces, buildPlacements, buildRoom, describePlacement, toStructured, type RoomPlan } from "./model.ts";
import { WIDGET_HTML } from "./widget.generated.ts";

export const SERVER_INFO = { name: "roomwise", version: "1.0.0" };
const WIDGET_URI = "ui://roomwise/plan.html";

const unit = z.enum(["in", "ft", "cm", "m"]).default("in").describe("Unit used for every length in this call (room, openings, furniture, positions). Default inches.");
const opening = z.object({
  wall: z.enum(WALLS).describe("Which wall the opening is on. North is the top wall of the plan, south the bottom, west the left, east the right."),
  offset: z.number().min(0).describe("Distance from the corner to the nearest edge of the opening: from the west end of a north or south wall, or from the north end of an east or west wall."),
  width: z.number().positive().describe("Width of the opening."),
  height: z.number().positive().optional().describe("Height of the opening; only used for paint estimates. Defaults to 80 in for doors and 48 in for windows."),
  swing: z.enum(["in", "out"]).optional().describe("Doors only: whether the door swings into the room (default) or outward."),
});
const roomShape = z.object({
  width: z.number().positive().describe("West-to-east length of the room."),
  length: z.number().positive().describe("North-to-south length of the room."),
  doors: z.array(opening).max(4).optional().describe("Doors. At least one is strongly recommended so walkways can be checked."),
  windows: z.array(opening).max(8).optional(),
});
const furniture = z.object({
  name: z.string().min(1).max(60).describe("Name shown on the plan, e.g. 'Sofa'."),
  kind: z.enum(KINDS).optional().describe("Type of furniture; it decides which clearance rules apply. Use 'generic' if none fit."),
  width: z.number().positive().describe("Side-to-side size of the piece as you face its front."),
  depth: z.number().positive().describe("Front-to-back size of the piece."),
  tall: z.boolean().optional().describe("True for pieces that must not cover a window, such as a bookcase."),
});
const placedFurniture = furniture.extend({
  x: z.number().min(0).describe("Distance from the room's west wall to the piece's west edge (after rotation)."),
  y: z.number().min(0).describe("Distance from the room's north wall to the piece's north edge (after rotation)."),
  facing: z.enum(WALLS).describe("Direction the front of the piece faces."),
});

const text = (t: string, structuredContent?: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ content: [{ type: "text" as const, text: t }], ...(structuredContent ? { structuredContent } : {}), ...extra });

function reportLines(r: LayoutReport): string {
  return r.results.map((x) => `${x.ok ? "PASS" : "FAIL"}: ${x.description}. ${x.detail}`).join("\n");
}

export interface ToolEnv {
  store: PlanStore;
  baseUrl: string;
}

export function createServer(env: ToolEnv): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Roomwise plans furniture layouts to scale and checks them against clearance rules. Always pass real measurements from the user; ask for any missing room size, door position or furniture size instead of guessing. Report failed checks to the user plainly.",
  });

  registerAppTool(
    server,
    "plan_room_layout",
    {
      title: "Plan a room layout",
      description:
        "Plans where furniture goes in one room, to scale. Given the room's size, door and window positions, and a list of furniture with sizes, it finds a layout and checks it against clearance rules: walkway width, door swings, sofa-to-coffee-table distance, dining and storage clearance, and whether every seat can be reached. Returns each piece's position and facing, a pass/fail report with measured values, and links to view and edit the plan on the web. Use when the user wants to arrange furniture or check whether pieces fit. It does not redesign a room from a photo or choose styles.",
      inputSchema: z.object({ unit, room: roomShape, furniture: z.array(furniture).min(1).max(25), save: z.boolean().default(true).describe("Save the plan and return links to view and edit it. Set false for a throwaway check.") }),
      annotations: { ...CREATES_PLAN, title: "Plan a room layout" },
      _meta: { ui: { resourceUri: WIDGET_URI } },
    },
    async (args) => {
      try {
        const u = args.unit as Unit;
        const room = buildRoom(args.room, u);
        const pieces = buildPieces(args.furniture, u, room);
        const res = solveLayout(room, pieces, { seed: 1, restarts: 14 });
        const plan: RoomPlan = { v: 1, unit: u, room, pieces, placements: res.placements, report: res.report, status: res.status, unplaced: res.unplaced };
        let links: { planId: string; viewUrl: string; editUrl: string } | undefined;
        if (args.save) {
          const { id, manageToken } = await env.store.create("room", plan);
          links = { planId: id, viewUrl: `${env.baseUrl}/p/${id}`, editUrl: `${env.baseUrl}/p/${id}#k=${manageToken}` };
        }
        const byId = new Map(pieces.map((p) => [p.id, p]));
        const lines = [
          `${res.status === "solved" ? "Layout found" : "Best layout found, but not every check passes"} for a ${fromInches(room.width, u)} × ${fromInches(room.length, u)} ${u} room: ${res.report.passed} of ${res.report.total} checks passed.`,
          "",
          reportLines(res.report),
          "",
          ...res.placements.map((pl) => describePlacement(byId.get(pl.id)!, pl, room, u)),
          ...(res.unplaced.length ? ["", `Could not fit: ${res.unplaced.map((id) => byId.get(id)!.name).join(", ")}.`] : []),
          "",
          links ? `Open and adjust the plan on the web: ${links.editUrl}\nView-only link to share: ${links.viewUrl}\nPlans are deleted 90 days after the last edit.` : "Plan not saved.",
          "These are estimates from rules of thumb, not building-code or structural advice.",
        ];
        return text(lines.join("\n"), { ...toStructured(plan), ...(links ?? {}) });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "check_room_layout",
    {
      title: "Check a room layout",
      description:
        "Checks a layout the user already has (or has edited) against the same clearance rules, without moving anything. Each piece needs its position (its north-west corner measured from the room's north-west corner) and the direction it faces. Returns pass/fail for each rule with measured values such as the narrowest walkway. Use to answer 'will this arrangement work?' for specific positions.",
      inputSchema: z.object({ unit, room: roomShape, furniture: z.array(placedFurniture).min(1).max(25) }),
      annotations: { ...READ_ONLY, title: "Check a room layout" },
    },
    async (args) => {
      try {
        const u = args.unit as Unit;
        const room = buildRoom(args.room, u);
        const pieces = buildPieces(args.furniture, u, room);
        const placements = buildPlacements(args.furniture, pieces, u);
        const report = verifyLayout(room, pieces, placements);
        return text(`${report.passed} of ${report.total} checks passed.\n\n${reportLines(report)}\n\nThese are estimates from rules of thumb, not building-code or structural advice.`, { unit: u, room, pieces, placements, report });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "estimate_room_materials",
    {
      title: "Estimate flooring, paint and baseboard",
      description:
        "Calculates how much flooring, paint and baseboard a room needs from its size and openings, with waste allowances, and the cost if unit prices are given. Returns floor area, paint gallons (exact and to buy), baseboard length and stated assumptions. Use for 'how much paint/flooring do I need?'. Prices are in the user's own currency; flooring is priced per square foot, baseboard per foot and paint per gallon.",
      inputSchema: z.object({
        unit,
        room: roomShape,
        ceilingHeight: z.number().positive().optional().describe("Ceiling height; default 8 ft (96 in)."),
        paint: z.object({ coats: z.number().min(1).max(4).optional(), coveragePerGallonSqFt: z.number().positive().optional().describe("Square feet one gallon covers; default 350."), includeCeiling: z.boolean().optional(), pricePerGallon: z.number().min(0).optional() }).optional(),
        flooring: z.object({ wastePercent: z.number().min(0).max(100).optional().describe("Default 10."), pricePerSqFt: z.number().min(0).optional() }).optional(),
        baseboard: z.object({ wastePercent: z.number().min(0).max(100).optional().describe("Default 10."), pricePerFoot: z.number().min(0).optional() }).optional(),
      }),
      annotations: { ...READ_ONLY, title: "Estimate flooring, paint and baseboard" },
    },
    async (args) => {
      try {
        const u = args.unit as Unit;
        const room = buildRoom(args.room, u);
        const m = estimateMaterials({
          room,
          wallHeight: args.ceilingHeight ? toInches(args.ceilingHeight, u) : undefined,
          paint: args.paint ? { coats: args.paint.coats, coveragePerGallonSqFt: args.paint.coveragePerGallonSqFt, ceiling: args.paint.includeCeiling, pricePerGallon: args.paint.pricePerGallon } : undefined,
          flooring: args.flooring,
          baseboard: args.baseboard,
        });
        const lines = [
          `Floor: ${m.floorAreaSqFt} sq ft (${m.flooringSqFtWithWaste} sq ft to buy with waste).`,
          `Walls: ${m.wallAreaSqFt} sq ft after doors and windows${m.ceilingAreaSqFt ? `; ceiling ${m.ceilingAreaSqFt} sq ft` : ""}.`,
          `Paint: ${m.paintGallons} gallons needed, buy ${m.paintGallonsToBuy}.`,
          `Baseboard: ${m.baseboardFeet} ft (${m.baseboardFeetWithWaste} ft to buy with waste).`,
          ...(m.costs.total !== undefined ? [`Cost: ${[m.costs.flooring !== undefined && `flooring ${m.costs.flooring.toFixed(2)}`, m.costs.paint !== undefined && `paint ${m.costs.paint.toFixed(2)}`, m.costs.baseboard !== undefined && `baseboard ${m.costs.baseboard.toFixed(2)}`].filter(Boolean).join(", ")}; total ${m.costs.total.toFixed(2)}.`] : []),
          "",
          "Assumptions:",
          ...m.assumptions.map((a) => `- ${a}`),
        ];
        return text(lines.join("\n"), { ...m });
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
    },
  );

  registerAppResource(server, "Room plan", WIDGET_URI, { description: "A to-scale plan with the rule checks", _meta: { ui: { prefersBorder: false } } }, async () => ({
    contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: WIDGET_HTML }],
  }));

  return server;
}

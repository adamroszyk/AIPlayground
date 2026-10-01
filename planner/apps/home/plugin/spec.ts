import type { PluginSpec } from "@planner/plugin-kit";
import { home } from "../site/content.ts";

const t = home.tokens;

export const spec: PluginSpec = {
  name: "roomwise",
  version: "1.0.0",
  description: "Plan where furniture goes in a room, to scale, and check it against clearance rules. Estimates flooring, paint and baseboard.",
  keywords: ["room layout", "furniture", "floor plan", "interior", "home"],
  displayName: "Roomwise",
  shortDescription: "Room layouts that check out",
  longDescription: [
    "Roomwise plans where furniture goes in one room, to scale, and then checks the result instead of just drawing it.",
    "",
    "Tell your assistant the room size, where the doors and windows are, and what you want to put in it. Roomwise finds an arrangement and checks it against clearance rules of thumb: main walkway width, door swings, space between sofa and coffee table, dining chair pull-back, and whether every piece can be reached. You get each piece's position and facing, a pass or fail for every rule with the measured value, and a link to open the plan in a web editor where you can drag pieces around and see the checks update.",
    "",
    "You can also give Roomwise an arrangement you already have and ask whether it works, or ask how much flooring, paint and baseboard a room needs, with waste allowances and a cost if you supply prices.",
    "",
    "Who it is for: anyone arranging a living room, bedroom, home office or dining room, or checking whether a sofa will fit before buying it.",
    "",
    "What it does not do: it does not redesign a room from a photo, pick styles or colours, order furniture, or give building-code, structural or safety advice. One rectangular room at a time. Results are rules of thumb, so measure twice.",
    "",
    "Saved plans are private links and are deleted 90 days after the last edit. No account is needed.",
  ].join("\n"),
  category: "Lifestyle",
  capabilities: ["Plan a room layout", "Check a layout", "Estimate flooring and paint"],
  defaultPrompt: [
    "Plan a 14 by 12 ft living room with a sofa, coffee table and TV unit.",
    "Will a 90-inch sofa fit without blocking the door?",
    "How much paint and flooring does a 12 by 10 ft bedroom need?",
  ],
  server: "roomwise",
  glyph: "room",
  brand: { light: t.light.accent!, dark: t.dark.accent!, darkBg: t.dark.bg!, lightBg: t.light.bg! },
  skill: {
    name: "get-started",
    description: "How to use Roomwise to plan and check a room layout, and what to ask the user first.",
    body: `
# Getting started with Roomwise

Use the Roomwise tools when someone wants to arrange furniture in a room, check whether a layout works, or estimate flooring, paint or baseboard.

## Ask before you plan

Never guess measurements. Make sure you have:

- Room width (west to east) and length (north to south).
- Each door and window: which wall, how far from the corner, how wide. Say which way north is on the plan: north is the top wall.
- Each piece of furniture with its width and depth. Offer typical sizes only if the user does not know, and say they are typical.

## Choose the tool

- \`plan_room_layout\`: find an arrangement. Use it for "where should things go" and "will this all fit".
- \`check_room_layout\`: verify positions the user already has. Use it for "will this arrangement work" and "does this sofa block the door".
- \`estimate_room_materials\`: flooring, paint and baseboard quantities.

## Report results honestly

- State how many checks passed and name every check that failed with its measured value.
- If pieces could not be placed, say so instead of implying everything fit.
- Share the edit link so the user can adjust the plan on the web, and the view-only link if they want to show someone. Tell them plans are deleted 90 days after the last edit.
- These are rules of thumb, not building-code or structural advice. Do not say a wall can be removed or that a layout is safe or code compliant.

## Out of scope

Redesigning from photos, choosing styles or colours, ordering furniture, multi-room floor plans, permits. Say what is not supported and offer what Roomwise can do.
`,
  },
  cases: {
    positive: [
      { description: "Plan a living room layout", prompt: "Plan a 14 by 12 foot living room with a sofa, a coffee table and a TV unit. The door is on the south wall 8 feet from the west corner and there is a window on the north wall.", tools_triggered: "plan_room_layout", expected_behavior: "Returns positions and facings for every piece, a pass or fail for each clearance check with measured values, and links to view and edit the plan." },
      { description: "Check a layout with a too-small gap", prompt: "Check my living room layout: the sofa is 6 inches from the coffee table. The room is 14 by 12 feet with a door on the south wall.", tools_triggered: "check_room_layout", expected_behavior: "Reports that the sofa-to-coffee-table gap rule fails and gives the measured distance." },
      { description: "Estimate flooring and paint", prompt: "How much flooring and paint do I need for a 14 by 12 foot room with 8 foot ceilings, one door and one window?", tools_triggered: "estimate_room_materials", expected_behavior: "Returns 168 square feet of floor, flooring to buy with a waste allowance, paint gallons needed and to buy, baseboard length, and the assumptions used." },
      { description: "Dining table with chair clearance", prompt: "Where can a 60 by 36 inch dining table and a sideboard go in a 12 by 11 foot room so the chairs can pull back? The door is on the south wall.", tools_triggered: "plan_room_layout", expected_behavior: "Places the table and sideboard and reports the dining chair clearance check with its measured value." },
      { description: "Will a sofa block the door", prompt: "Can I fit a 90 inch sofa in front of the door? The room is 12 by 12 feet and the door is 32 inches wide on the south wall, 4 feet from the corner, swinging in.", tools_triggered: "check_room_layout", expected_behavior: "Reports that the sofa overlaps the door swing or blocks the walkway, with the measured values." },
    ],
    negative: [
      { description: "Redesign from a photo (unsupported)", prompt: "Here is a photo of my living room. Redesign it in a modern style." },
      { description: "Ordering furniture (unsupported)", prompt: "Order the grey sofa I picked and have it delivered next week." },
      { description: "Structural advice (out of scope)", prompt: "Is this wall load-bearing? Can I safely remove it to open up the room?" },
    ],
  },
  releaseNotes: "Initial release: room layout planning, layout checking and materials estimates, with a web editor for saved plans.",
};

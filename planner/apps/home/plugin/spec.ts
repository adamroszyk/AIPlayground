import type { PluginSpec } from "@planner/plugin-kit";
import { home } from "../site/content.ts";

const t = home.tokens;

export const spec: PluginSpec = {
  name: "roomwise",
  version: "1.0.0",
  description: "Room layout planner for home redesign, remodel and decorating projects. Plan where furniture goes, check that it fits against clearance rules, and estimate flooring, paint and baseboard.",
  keywords: ["home redesign", "room layout", "furniture arrangement", "floor plan", "home remodel", "house decor", "interior design", "living room layout", "bedroom layout", "room planner", "home renovation", "flooring estimate", "paint calculator"],
  displayName: "Roomwise",
  shortDescription: "Home redesign room planner",
  longDescription: [
    "Plan a room layout for a home redesign, remodel or decorating refresh. Roomwise works out where furniture goes in one room, to scale, then checks the arrangement against clearance rules so you can see whether it will work before you move or buy anything.",
    "",
    "What you can ask:",
    "- Furniture layout and floor plan: give the room size, where the doors and windows are, and the furniture you want to use (living room, bedroom, home office or dining room). Roomwise returns each piece's position and facing, and a link to a to-scale plan you can edit on the web by dragging pieces around.",
    "- Will it fit? Give an arrangement you already have, or a sofa, bed or table you are thinking of buying. Roomwise checks walkway width, door swings, sofa-to-coffee-table distance, dining chair pull-back and whether every piece can be reached, with the measured value for each rule.",
    "- Remodel and renovation planning: how much flooring, paint and baseboard a room needs, with waste allowances, and a cost if you supply prices.",
    "",
    "Who it is for: homeowners and renters planning a home redesign, a room refresh or a remodel, and anyone working out house decor layouts such as where the sofa, coffee table or dining table should go.",
    "",
    "How it works: you describe the room in words and measurements. Roomwise does not need a photo. Results are rules of thumb for comfort and access, so measure twice.",
    "",
    "What it does not do: it does not redesign a room from a photo, choose styles, colours or decor, order furniture, or give building-code, structural or safety advice. One rectangular room at a time.",
    "",
    "Privacy: saved plans are private links, deleted 90 days after the last edit. No account is needed.",
  ].join("\n"),
  category: "Productivity",
  capabilities: ["Plan a furniture layout", "Check whether furniture fits", "Estimate flooring, paint and baseboard"],
  defaultPrompt: [
    "Help me redesign my living room layout: 14 by 12 ft with a sofa, coffee table and TV unit.",
    "Will a 90-inch sofa fit in my room without blocking the door?",
    "How much paint and flooring do I need to remodel a 12 by 10 ft bedroom?",
  ],
  server: "roomwise",
  glyph: "room",
  brand: { light: t.light.accent!, dark: t.dark.accent!, darkBg: t.dark.bg!, lightBg: t.light.bg! },
  skill: {
    name: "get-started",
    description: "Use when someone wants help with a home redesign, room refresh, remodel or decorating project: plan a furniture layout or floor plan, check whether furniture fits, or estimate flooring, paint and baseboard. Ask for measurements first.",
    body: `
# Getting started with Roomwise

Roomwise plans furniture layouts for one room, checks them against clearance rules, and estimates flooring, paint and baseboard.

## When to use it

Use the Roomwise tools when someone is working on a home redesign, room refresh, remodel, renovation or decorating project and asks to:

- arrange or rearrange furniture, or make a furniture layout or floor plan for a living room, bedroom, home office or dining room
- check whether a sofa, bed, desk or table will fit, or whether an arrangement blocks a door or walkway
- work out how much flooring, paint or baseboard a room needs

## When not to use it

Redesigning from a photo, choosing styles, colours or decor, ordering furniture, multi-room floor plans, permits, and anything about walls, structure or building codes. Say what is not supported and offer what Roomwise can do (the layout and the measurements).

## Ask before you plan

Never guess measurements. Make sure you have:

- Room width (west to east) and length (north to south).
- Each door and window: which wall, how far from the corner, how wide. North is the top wall of the plan.
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

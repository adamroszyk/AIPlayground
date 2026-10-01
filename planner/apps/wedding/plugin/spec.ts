import type { PluginSpec } from "@planner/plugin-kit";
import { wedding } from "../site/content.ts";

const t = wedding.tokens;

export const spec: PluginSpec = {
  name: "aisle-seating",
  version: "1.0.0",
  description: "Wedding seating chart maker and day-of timeline builder. Seat guests around your rules (together, apart, head table), check an existing seating plan, and build a wedding day schedule.",
  keywords: ["wedding seating chart", "reception seating", "table plan", "seating arrangement", "seating plan", "wedding planning", "wedding timeline", "wedding day schedule", "head table", "guest list"],
  displayName: "Aisle Seating Chart",
  shortDescription: "Wedding seating chart maker",
  longDescription: [
    "Make a wedding seating chart that follows your rules. Aisle seats your guests at the reception tables, keeps couples and families together, keeps people apart when you need to, and then re-checks every rule on the finished table plan so you can see that it works.",
    "",
    "What you can ask:",
    "- Seating chart and table plan: give the guest list (first names are enough, with optional groups such as \"bride's family\" and parties such as couples or families with kids), the tables and their sizes, and your rules: who must sit together, who must be kept apart, who sits at the head table, and anyone who has to be at a particular table. You get who sits where, a pass or fail for each rule, and a link to edit the chart on the web by dragging guests between seats.",
    "- Does my seating plan work? Give a seating arrangement you already have and Aisle checks it against your rules.",
    "- Wedding day timeline: from the ceremony start time, build a schedule for guest arrival, ceremony, photos, travel between venues, cocktail hour, dinner, toasts, first dance, cake and dancing, with buffers and warnings for a venue curfew or photos after sunset.",
    "",
    "If your rules cannot all be met, Aisle says which ones conflict and why, shows the closest chart it could build, and names the rules you could relax.",
    "",
    "Who it is for: couples, parents and wedding planners with a guest list and a few awkward seating rules.",
    "",
    "What it does not do: it is not a full wedding planner. It does not book vendors, send invitations, manage RSVPs or budgets, take payments, or know your venue's floor plan (you give it the number and size of tables). Please use first names or initials where you can.",
    "",
    "Privacy: saved charts are private links, deleted 90 days after the last edit. No account is needed.",
  ].join("\n"),
  category: "Productivity",
  capabilities: ["Make a wedding seating chart", "Check a seating plan against your rules", "Build a wedding day timeline"],
  defaultPrompt: [
    "Make a wedding seating chart for 60 guests at tables of 8 and keep the Smiths together.",
    "Does my reception seating plan follow my rules? Here are the tables and who sits where.",
    "Build a wedding day timeline for a 4pm ceremony with a 20 minute drive to the reception.",
  ],
  server: "aisle",
  glyph: "table",
  brand: { light: t.light.accent!, dark: t.dark.accent!, darkBg: t.dark.bg!, lightBg: t.light.bg! },
  skill: {
    name: "get-started",
    description: "Use when someone wants a wedding seating chart, reception table plan or seating arrangement built around rules, wants to check one they already have, or wants a wedding day timeline. Ask for the guests, tables and rules first.",
    body: `
# Getting started with Aisle

Aisle builds wedding seating charts that satisfy the couple's rules, checks existing ones, and builds a day-of timeline.

## When to use it

Use the Aisle tools when someone is planning a wedding or reception and asks to:

- make a seating chart, table plan or seating arrangement, with people who must sit together or apart, a head table, or fixed seats
- check whether a seating plan they already have follows their rules
- build a wedding day timeline or schedule from the ceremony start time

## When not to use it

Booking vendors, sending invitations, RSVPs, budgets, payments, venue floor plans, and seating rules based on location in the room (near the exit, near the stage). Aisle is not a full wedding planner: say what is not supported and offer what Aisle can do.

## Ask before you plan

- The guest list. First names or initials are enough. Every name must be unique (add a last initial if two guests share a first name).
- Groups (for example "Bride's family", "College friends") and parties: couples, plus-ones and families with kids who must always sit together.
- The tables: how many, how many seats each, and which is the head table.
- The rules: who must sit together, who must be kept apart, who is at the head table, anyone fixed to a table. Do not invent rules the user did not state.

## Choose the tool

- \`plan_wedding_seating\`: build a chart from the guests, tables and rules.
- \`check_wedding_seating\`: verify a chart the user already has.
- \`build_wedding_timeline\`: day-of schedule from the ceremony start time (24-hour HH:MM). Ask for travel time and venue curfew if they matter.

## Report results honestly

- Say how many rules were met and name any that were not.
- If the rules conflict, relay the conflict and suggest which rule to relax. Do not pretend the chart works.
- Share the edit link so the user can drag guests around on the web, and the view-only link to show others. Tell them charts are deleted 90 days after the last edit.
- Guest names are personal data about other people. Do not ask for more than names, groups and rules.
`,
  },
  cases: {
    positive: [
      { description: "Seat 60 guests with rules", prompt: "Seat my 60 wedding guests at 8 tables of 8. Keep the four Smiths together and make sure Alex and Jo are at different tables.", tools_triggered: "plan_wedding_seating", expected_behavior: "Seats every guest, keeps the Smiths at one table and Alex and Jo at different tables, reports each rule as met, and returns view and edit links." },
      { description: "Check an existing chart", prompt: "Check this seating chart. Tables of 4. Table 1: Ann, Bob, Cy. Table 2: Dee, Eli. Ann and Eli must not sit together, and Bob and Dee must sit together.", tools_triggered: "check_wedding_seating", expected_behavior: "Reports the keep-together rule for Bob and Dee as failing and the keep-apart rule as met, with each rule's result." },
      { description: "Build a day-of timeline", prompt: "Build a timeline for a 4pm wedding ceremony with a 20 minute drive to the reception and a venue curfew of 11pm.", tools_triggered: "build_wedding_timeline", expected_behavior: "Lists segments with start and end times from the 4pm ceremony including the travel, and warns about the 11pm curfew if the schedule runs past it." },
      { description: "Head table", prompt: "Seat 20 guests at tables of 6 plus a head table of 6. Put the bride, groom and both sets of parents at the head table.", tools_triggered: "plan_wedding_seating", expected_behavior: "Seats the named guests at the head table, seats everyone else at regular tables, and reports the head table rule as met." },
      { description: "Rules that cannot all be met", prompt: "Seat Ann, Bob and Cy at two tables of 2. Ann and Bob must sit together, but Ann and Bob must also be kept apart.", tools_triggered: "plan_wedding_seating", expected_behavior: "Says the rules cannot all be met, explains that the two rules contradict each other, and suggests which rule to relax." },
    ],
    negative: [
      { description: "Book a vendor (unsupported)", prompt: "Book a photographer for my wedding in Austin on June 14." },
      { description: "Send invitations (unsupported)", prompt: "Email invitations to everyone on my guest list." },
      { description: "Take a payment (no commerce)", prompt: "Charge my card for the venue deposit." },
    ],
  },
  releaseNotes: "Initial release: seating chart planning, chart checking and a day-of timeline, with a web editor for saved charts.",
};

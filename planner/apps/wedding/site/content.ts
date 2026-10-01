import type { ProductConfig } from "@planner/core";
import { weddingHeroSvg } from "./art.ts";

export const wedding: ProductConfig = {
  key: "wedding",
  name: "Aisle",
  kind: "wedding seating and timeline planner",
  metaTitle: "Aisle: Wedding Seating Chart Maker and Timeline",
  metaDescription: "Make a wedding seating chart that follows your rules: who sits together, who sits apart, head table. Plus a wedding day timeline. Early access.",
  eyebrow: "Early access · Wedding seating and timeline",
  headline: "Seating charts that follow every rule.",
  sub: "List your guests and who can't sit near whom. Aisle builds the chart, shows that every rule is met, and lets you move people around without quietly breaking one.",
  heroSvg: weddingHeroSvg(),
  heroCaption: "Illustrative example: six tables and a head table with all 12 rules met.",
  stepsHeading: "How it works",
  steps: [
    { title: "Add your guests", body: "Names, groups, plus-ones and kids. Paste a list or type it in chat. First names are enough." },
    { title: "Say your rules", body: "Keep the Garcias together. Keep two people apart. Grandparents near the exit. Head table here." },
    { title: "Get a chart that checks out", body: "Aisle seats everyone and lists each rule as met or not, so nothing is a guess." },
    { title: "Adjust, then plan the day", body: "Swap guests and re-check instantly, then build a day-of timeline with buffers." },
  ],
  checksHeading: "What it checks",
  checksIntro: "Every rule you set, plus the basics, re-checked on the final chart.",
  checks: [
    "No table is over capacity",
    "Groups you marked together share a table",
    "People you marked apart do not",
    "Head table and fixed seats stay where you put them",
    "Plus-ones and kids are seated with their group",
    "Everyone is seated exactly once",
  ],
  featuresHeading: "Built for the part chat gets wrong",
  features: [
    { title: "A chart that obeys your rules", body: "Chatbots write seating charts that look right and quietly break a rule. Aisle checks the result against every one." },
    { title: "It tells you why it failed", body: "If your rules can't all be met, Aisle names the ones that conflict instead of hiding it." },
    { title: "Chat and web, one plan", body: "Built to work from an AI assistant and on the web. Drag guests around on the web and Aisle re-checks as you go." },
    { title: "A timeline that adds up", body: "Give the ceremony time, travel and photo windows. Aisle adds buffers and flags clashes." },
  ],
  limitsHeading: "What it does not do yet",
  limits: [
    "It is not a full wedding planner yet. Budget, vendors and RSVPs are not included.",
    "It does not book vendors or send invitations.",
    "It does not know your venue's floor plan. You tell it the number and size of tables.",
    "It follows the rules you give it and cannot read family dynamics you don't mention.",
  ],
  faq: [
    { q: "Is it free?", a: "Early access is free. We will tell you before anything changes." },
    { q: "Can I use first names only?", a: "Yes. First names or initials are enough, and less personal data is better." },
    { q: "How many guests can it handle?", a: "It is designed for typical wedding sizes. We will publish the tested limits before launch." },
    { q: "What if my rules are impossible?", a: "Aisle tells you which rules conflict and why, and shows the closest chart it could build." },
    { q: "Do you store my guest list?", a: "Only in the plan you create, at a private link. It is deleted 90 days after you last edit it, or sooner on request." },
    { q: "Can I use it with ChatGPT?", a: "It is being prepared for the ChatGPT plugin directory. Early-access members will hear first." },
  ],
  headingFont: `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`,
  tokens: {
    light: { bg: "#fbf7f3", fg: "#2a2230", muted: "#675b6c", line: "#eadfe0", card: "#fffdfb", accent: "#7b2d5b", "accent-fg": "#ffffff", accent2: "#c08a3e", ok: "#2c7f52", err: "#b3342f", floor: "#fbf7f3", rug: "#f1e6e8", item: "#efe3e1", "item-line": "#b79aa6", item2: "#e6d4d6", g1: "#7b2d5b", g2: "#d98aa6", g3: "#3f8f8a", g4: "#c99a3e", g5: "#6b7fb3" },
    dark: { bg: "#17121a", fg: "#f1e9f1", muted: "#b9a9bd", line: "#2b2230", card: "#1f1824", accent: "#e08fc0", "accent-fg": "#1a1020", accent2: "#e0b45e", ok: "#5bc489", err: "#ff8f8f", floor: "#17121a", rug: "#241a29", item: "#2c2233", "item-line": "#7d6586", item2: "#33263b", g1: "#d27bb0", g2: "#f0a9c4", g3: "#66c4bd", g4: "#e6c26c", g5: "#94a8de" },
  },
  data: {
    planData: ["Guest names or initials, groups and seating rules", "Table counts and sizes", "Timeline anchors such as ceremony time"],
    planRetentionDays: 90,
    thirdPartyNote: "Guest names you type into ChatGPT are processed by OpenAI under its own policy.",
  },
  appPath: "/app/",
  disclaimer:
    "Seating charts and timelines are suggestions generated from the guests and rules you provide. Check them before you print or share them. We are not responsible for vendor, venue or guest outcomes.",
};

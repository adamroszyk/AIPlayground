import type { ProductConfig } from "@planner/core";
import { homeHeroSvg } from "./art.ts";

export const home: ProductConfig = {
  key: "home",
  name: "Roomwise",
  kind: "room layout planner",
  metaTitle: "Roomwise: Room Layout Planner That Checks Clearances",
  metaDescription: "Describe your room and furniture. Get a to-scale layout checked for walkways, door swings and clearances, plus a flooring and paint estimate. Early access.",
  eyebrow: "Early access · Room layout planner",
  headline: "Plan a room that actually fits.",
  sub: "Tell Roomwise your room size, doors, windows and furniture. It draws a layout to scale, checks walkways, door swings and clearances, and totals the flooring and paint you need.",
  heroSvg: homeHeroSvg(),
  heroCaption: "Illustrative example: a 14 × 12 ft living room with every check passed.",
  stepsHeading: "How it works",
  steps: [
    { title: "Describe your room", body: "Give the size, where the doors and windows are, and the furniture you own or want. Type it in chat or fill in a form." },
    { title: "Get a layout to scale", body: "Roomwise places and rotates each piece and keeps it clear of doors, windows and walkways." },
    { title: "See what passed", body: "Every rule is listed with the measured value, so you can see why a spot works or doesn't." },
    { title: "Adjust and estimate", body: "Move pieces and re-check, then get flooring, paint and baseboard quantities with a waste allowance." },
  ],
  checksHeading: "What it checks",
  checksIntro: "Common design rules of thumb, with the actual measurement shown next to each. You can change any threshold.",
  checks: [
    "Main walkways at least 36 in wide",
    "Secondary paths at least 30 in",
    "Door swings stay clear",
    "Nothing blocks a window or a door",
    "Sofa to coffee table 14 to 18 in",
    "Dining chairs have room to pull back",
    "Nothing overlaps and nothing pokes through a wall",
  ],
  featuresHeading: "Built for the part chat can't do",
  features: [
    { title: "Scale you can trust", body: "Chat can describe a room and image tools can restyle a photo, but neither guarantees a sofa fits. Roomwise works in real inches." },
    { title: "Proof, not a guess", body: "Each result comes with a pass or fail report computed separately from the layout, so a mistake can't hide." },
    { title: "Chat and web, one plan", body: "Built to work from an AI assistant and on the web. The plan you adjust on the web is the one you asked for in chat." },
    { title: "Quantities, not just pictures", body: "Flooring, paint and baseboard totals with a waste allowance, priced from your own unit costs." },
  ],
  limitsHeading: "What it does not do yet",
  limits: [
    "It does not turn a photo of your room into a plan. You enter measurements.",
    "It does not create photorealistic renders. Your assistant's image tools can style a room from the layout.",
    "It plans one room at a time.",
    "The rules are common rules of thumb, not building-code or structural advice.",
  ],
  faq: [
    { q: "Do I need an account?", a: "No. Early access needs no account. Each plan is saved at a private link that you can share or delete." },
    { q: "Can it work from a photo of my room?", a: "Not in the first version. You enter measurements, which is what lets Roomwise guarantee the layout fits. Photo capture is something we may add later." },
    { q: "Is it free?", a: "Early access is free. We will tell you before anything changes." },
    { q: "How accurate is it?", a: "It computes in inches from the numbers you give it, and shows each check's measured value. The result is only as good as the measurements, so measure twice." },
    { q: "Can I use it with ChatGPT?", a: "It is being prepared for the ChatGPT plugin directory. Early-access members will hear first. Until then, access is through early access only." },
    { q: "What happens to my data?", a: "Plans are stored at private links and deleted 90 days after you last edit them, or sooner on request. See the privacy policy for details." },
  ],
  headingFont: `"Avenir Next","Segoe UI",system-ui,sans-serif`,
  tokens: {
    light: { bg: "#faf8f4", fg: "#1f2a2b", muted: "#5a6868", line: "#e6e0d6", card: "#fffdf9", accent: "#1f6f6a", "accent-fg": "#ffffff", accent2: "#c9633a", ok: "#2c7f52", err: "#b4412f", floor: "#f1ece2", rug: "#e3d8c6", item: "#cfd9d6", "item-line": "#7d9490", item2: "#b9c9c5" },
    dark: { bg: "#121716", fg: "#e9efee", muted: "#9db0ae", line: "#26312f", card: "#182120", accent: "#4fc1b8", "accent-fg": "#0d1514", accent2: "#e08a63", ok: "#5bc489", err: "#ff8f7e", floor: "#1b2423", rug: "#25302d", item: "#2e4a47", "item-line": "#6fa39d", item2: "#2a4340" },
  },
  data: { planData: ["Room dimensions", "Door and window positions", "Furniture names and sizes"], planRetentionDays: 90 },
  disclaimer:
    "Layouts and quantities are estimates based on the measurements and rules you provide. They are not architectural, structural, electrical or building-code advice. Measure twice, and check local requirements and your supplier's quantities before you buy or build.",
};

# Ambitious ideas: "something ChatGPT cannot do on its own"

Date: 2026-10-01. Evidence is search-snippet level (openai.com, magicpath.ai, x.com were blocked). No search-volume data was found for any idea below.

## What MagicPath actually is (from the DevDay photo and search)

MagicPath is an AI design/prototyping company (founder Pietro Schirano) that launched a **plugin extension** in ChatGPT with OpenAI, live on web and desktop:
an infinite canvas in the sidebar where chat builds landing pages, prototypes, presentations and diagrams, with files and a shared live canvas.
([Pietro's announcement, via search](https://x.com/skirano/status/2095199204654133617), [TechCrunch on plugin extensions](https://techcrunch.com/2026/09/29/openai-expands-chatgpts-plugins-with-app-like-interfaces-and-automations/).)

Lessons:

- Plugin extensions give an app **a sidebar home, an interactive panel, custom file viewers and automations** (a connected app can trigger ChatGPT when something happens).
- DevDay slots went to **funded companies with real products** (reported launch partners include Adobe, Figma, Canva, Notion, HubSpot, Salesforce, Harvey). It is not a "simple utility" stage.
- The pattern that works: **chat is the interface; the app is a persistent, visual, stateful workspace the model cannot provide.**

Caveat: the sidebar/extension APIs are not documented in anything I could read. What we have *verified* is the MCP Apps widget (see `toolbox/`).

## Criteria

A good ambitious idea should (1) fail when you just ask ChatGPT, (2) need a visual, persistent workspace, (3) not be occupied by a funded chat-native competitor,
(4) be buildable by a small AI-assisted team, (5) have some demand signal, (6) use the new platform features (panel, automations).

## Candidates (scores 1-5, judgement, unvalidated)

| Idea | Chat fails | Needs visual workspace | Field open | Feasible | Demand signal | Platform fit | Total /30 |
|---|---|---|---|---|---|---|---|
| **Constraint-solver workspace** (rosters, seating, timetables) | 5 | 5 | 4 | 4 | 3 | 5 | **26** |
| Floor / space planner | 4 | 5 | 3 | 3 | 3 | 4 | 22 |
| AI design canvas (MagicPath-like) | 4 | 5 | 1 | 2 | 4 | 5 | 21 |
| Founder financial model / cap table | 3 | 4 | 3 | 3 | 3 | 4 | 20 |
| Live dashboards from chat | 3 | 5 | 1 | 3 | 4 | 4 | 20 |
| Programmatic motion / video (Poko Motion) | 5 | 5 | 1 | 2 | 3 | 4 | 20 |
| Text-to-CAD for 3D printing | 4 | 5 | 2 | 2 | 3 | 4 | 20 |

Why the low "field open" scores:

- **Motion/video:** [ChatCut](https://chatcut.io/chatgpt-plugin) is a ChatGPT plugin; there is a Remotion plugin; Runway launched an official hosted MCP (May 2026); Orshot renders video over MCP.
- **Text-to-CAD:** [AdamCAD](https://pasqualepillitteri.it/en/news/3372/adamcad-text-to-cad-ai-review-2026) (YC W25, $4.1M seed), open-source CADAM, Zoo.dev.
- **Design canvas / diagrams:** MagicPath, Figma, Canva, Adobe, Excalidraw and tldraw already have MCP Apps.

## Recommended direction: a constraint-solver workspace

**Idea.** The user describes a scheduling or arrangement problem in plain language. The app converts it to hard and soft constraints, solves it with a real solver
(OR-Tools CP-SAT), and shows an editable board with proof that every rule holds. Edits by chat or drag trigger a minimal-change re-solve.

**Why chat fails.** LLMs produce plausible-looking schedules that quietly break rules.
- TravelPlanner: GPT-4 passed 0.6% of tasks that require all hard constraints at once ([paper](https://www.alphaxiv.org/abs/2402.01622)). That is a 2024 benchmark on older models; newer models do better, but the failure mode is structural.
- A vendor test (so biased, but consistent) reports ChatGPT schedules violating stated rules such as rest periods and day limits ([ShiftScheduleMaker blog](https://shiftschedulemaker.net/en/blog/can-chatgpt-make-a-schedule)).

**Why it needs a workspace.** A schedule or seating plan is a visual grid or map that persists across weeks, gets tweaked by several people, and exports (xlsx / PDF / ICS).
The automation feature adds a real hook: "someone called out → re-solve and notify".

**Competition (not exhaustive).** Timefold and Solvice sell scheduling solver APIs to developers; Homebase, Deputy, When I Work and 7shifts own shift scheduling for staff apps;
seating-chart and bracket tools are fragmented web apps. I found **no chat-native solver app** in the snippets, but absence of evidence is weak here.

**Two possible first wedges (pick one).**

| | Shift roster for small teams | Wedding / event seating |
|---|---|---|
| Fit with "done by hand weekly" heuristic | Excellent (recurring) | Poor (one-off) |
| Willingness to pay | High (businesses pay for scheduling) | Low-medium (one-time) |
| Demo appeal | Medium | High (visual, emotional) |
| Competition | Strong SaaS incumbents | Fragmented |
| Automation story | Strong (call-outs, swaps) | Weak |

**Vertical slice (roster).** In chat: "6 staff, 2 cooks, open 11-10 Tue-Sun. Maria can't do Sundays, nobody over 5 days, 11 hours rest." → solver → weekly grid in the panel with a
"14/14 rules satisfied" badge and per-person hours → "swap Ben and Maria on Friday" re-solves minimally → export xlsx/PDF/ICS.
Reuses from `toolbox/`: the MCP server, the MCP App widget pipeline, the site builder, landing-page structure.

## What to check before building (cheap, decisive)

1. **20-minute test.** Give the current ChatGPT model five realistic scheduling prompts (rest rules, skill coverage, availability, fairness). Count rule violations. If it is near zero, this idea is weaker than I think.
2. Google Keyword Planner on "shift schedule maker", "employee schedule generator", "seating chart maker", "work schedule template".
3. Check the ChatGPT plugin directory and Glama/Smithery for existing roster or seating tools.
4. Talk to 5 shift managers (restaurants, clinics, retail) about how they do it this week.

## What I would not do

- Poko Motion / video: occupied in ChatGPT already.
- A general design canvas: MagicPath has the OpenAI partnership and a team.
- Text-to-CAD: funded YC competitors and a hard kernel problem.

---

# Round 2: eight more ideas (same criteria, competition checked first)

Evidence is snippet-level; no search volume was found for any of these.

| # | Idea | Chat fails | Visual workspace | Field open | Feasible | Demand signal | Platform fit | Total /30 | Competition found |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Geospatial site-selection / territory workspace | 4 | 5 | 2 | 3 | 3 | 5 | 22 | Felt MCP (builds live maps from prompts), Mapbox MCP (isochrones, live map in chat), CARTO site-selection and territory skills |
| 2 | Home electrification planner (solar + battery + heat pump + EV payback) | 4 | 4 | 3 | 3 | 3 | 4 | 21 | Many web calculators on NREL PVWatts; only a generic solar-calculator MCP found; no chat-native planner seen |
| 3 | Trip planner that verifies feasibility on a map | 4 | 5 | 1 | 3 | 3 | 4 | 20 | Expedia in ChatGPT, Wanderlog, Mindtrip, Layla; reviews say Wanderlog suggests closed places and Mindtrip proposes infeasible flights |
| 4 | Synthetic-user website testing with replays | 5 | 4 | 1 | 2 | 3 | 4 | 19 | Uxia, Maze, UserTesting, Synthetic Users, CanaryUsers, Meerkat, Swarm |
| 5 | Term sheet comparison + exit-waterfall explorer | 3 | 4 | 3 | 4 | 2 | 3 | 19 | Carta free exit simulator, Pulley, Foresight cap table + waterfall tool; no AI/chat version found |
| 6 | Provenance viewer (click a number, see the highlighted source) | 3 | 4 | 1 | 3 | 3 | 5 | 19 | Reducto (page + bounding-box citations), LlamaParse, Hebbia, NotebookLM, Adobe AI Assistant |
| 7 | Meal plan with exact macros + grocery list | 3 | 3 | 1 | 3 | 3 | 3 | 16 | Eat This Much, Cronometer, Mealime, Nutrition MCP; one blog says ChatGPT macro estimates run 10-20% off |
| 8 | A/B test design and analysis workspace | 2 | 3 | 2 | 4 | 2 | 3 | 16 | Statsig, Eppo, GrowthBook calculators |

Rejected without scoring: AI eval canvas (Braintrust, LangSmith, Promptfoo), audio/music editing (Descript, Suno, licensing risk),
persistent flashcard/learning workspace (Quizlet, Anki), competitor-page monitoring (Visualping, Klue).

## What round 2 taught us

1. **The canvas is a commodity.** Maps (Felt, Mapbox), diagrams (Excalidraw, tldraw), design (MagicPath, Figma), video (ChatCut, Runway) all already ship chat-native visual apps.
   A new entrant cannot win on "a visual workspace in chat".
2. **The remaining gaps are correctness engines on narrow problems**: a solver that proves constraints hold, a rules engine for liquidation stacks,
   a data-plus-incentives model for home energy. The moat is the verified engine and domain data, not the UI.
3. **That favours the solver workspace** (26) over everything here (best new score: 22). It also matches what we already built in `toolbox/`: deterministic engines behind an MCP server.
4. The two new ideas with a plausible open lane are **home electrification** and **term sheet / exit waterfall**. Electrification has consumer demand but data-freshness and incentive-rule upkeep.
   The waterfall is founder-native and cheap but a small market, and Carta's own simulator is free.

Caveat: all scores are judgement from snippets, and "no chat-native competitor found" is weak evidence. The 20-minute ChatGPT test and a keyword check remain the deciding steps.

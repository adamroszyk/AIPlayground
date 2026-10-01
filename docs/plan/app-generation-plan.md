# App generation plan: Home room planner + Wedding planner

Status: living document, updated every loop pass. Last updated 2026-10-01. P0 to P4 are built and tested; P5 deploy tooling is built; the go-live steps that need your accounts are in `go-live.md`.
Scope per your instruction: focus on **home redesign** and **wedding planner**; order of work **landing page → MVP → vertical slice**, then plugin integration, then a live production test.

Working names (change in one config file each): **Roomwise** (home) and **Aisle** (wedding). Collision/trademark checks are not done.

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | **Cloudflare Workers** (static assets + Worker + D1 for plans, KV for the waitlist) | Verified here: the MCP server runs in the real Workers runtime (`workerd`) through the web-standard handler. One deploy serves site, `/mcp`, `/.well-known/openai-apps-challenge`, and storage; DNS and TLS in the same account. Vercel is the fallback |
| Repo | New npm workspace `planner/` with `packages/core`, `packages/engine`, `apps/home`, `apps/wedding` | Two products, one shared engine and site/MCP kit |
| Plugins | **Two plugins**, two hostnames | OpenAI allows **one MCP server per plugin**; listings need distinct names; the domain-verification token is per hostname |
| Format | Agent Plugins layout (root `plugin.json` with `extensions.com.openai`) | Portable; matches the doc's first example |
| Product surfaces | Web app (full editor) + ChatGPT widget + skills | Doc rule: a plugin must not be a worse version of the website, so both call the same engine |
| MVP shape | **Layout/arrangement solver, not image generation** | Chat cannot verify geometry or constraints; ChatGPT can already restyle images |
| Auth | **None** in MVP (no sign-in), unlisted plan links with random ids | Avoids reviewer-credential and OAuth work; wedding guest names are personal data, so retention and deletion must be built (below) |

## 2. What OpenAI's submission doc requires (from the pasted page, firsthand)

| Requirement (verbatim intent) | What we build |
|---|---|
| ZIP with manifest; **MCP server must be in the first ZIP**; adding MCP to a skills-only plugin is not supported | Include the MCP config in v1 of each package |
| **Changing the MCP server URL requires support** | Fix the production hostname **before** first upload (needs your domain) |
| Exactly **one** remote MCP server per plugin, `type: streamable-http` in `mcp.json` | `mcp.json` with a single server per plugin |
| Package must not contain app references (`apps`, `.app.json`) or lifecycle hooks; no credentials; `test_credentials` / `reviewer_instructions` rejected | Packager script lints for these |
| Domain verification: plain-text token at `https://<host>/.well-known/openai-apps-challenge`, exact token only, not JSON | Worker route reading a secret `OPENAI_APPS_CHALLENGE`; **built now** |
| Verified publisher identity (individual or business); owner or Apps Management Write | **You**: verify in the OpenAI dashboard; landing pages must show the **same publisher name** |
| Listing: `displayName` ≤30, `shortDescription` ≤30, `longDescription` ≤4000, `developerName` ≤80, `category`, 4 HTTPS URLs (website, support, privacy, terms), ≤3 `defaultPrompt` (≤128 chars, no @mentions), brand colours (≥2:1 contrast), `logo` + `composerIcon` square ≥48px, PNG/JPEG/WebP/SVG ≤5 MiB | Manifest generator validates all limits; **landing build produces website/support/privacy/terms pages now** |
| Review info: **5 positive + 3 negative test cases** (prompt, expected tools, expected result), **demo recording URL**, release notes, `commerce: false` | Drafted in section 5; recording is yours (I will write the script) |
| Reviewer credentials only if sign-in is needed | None needed |
| Daily MCP scan; **tool metadata changes are held until reviewed**; new tools unavailable until approved; keep compatible with approved schemas | **Design three stable tools per product up front**; additive optional params only; schema-compat test in CI |
| Package metadata/skills/MCP config changes need a **new ZIP**; tool changes do not | Separate `plugin/` package from deployed server |
| Skills-only plugins don't need MCP review cases or a demo | We ship one onboarding skill each |
| Not covered by the doc I have: UI guidelines and "Plugin UI reference", extensions, events, plugin guidelines, MCP review requirements | Widget is built with the MCP Apps SDK (verified on the Claude side); **must be re-checked against OpenAI's UI reference when you share it** |

## 3. Product scope

### Roomwise: room layout planner

- **Job:** describe a room (dimensions, doors, windows) and furniture; get a **to-scale layout** that is **verified** against clearance rules, plus a **materials and cost estimate**.
- **Rules (editable defaults, rules of thumb):** main walkway ≥36 in, secondary ≥30 in, door swing clear, sofa-to-coffee-table 14-18 in, dining chair pull-back ≥36 in, no overlaps, nothing blocking windows/doors.
- **MVP tools (stable):**
  1. `plan_room_layout`: room + openings + furniture + preferences → positions, rotations, rule report, `planId`, `editUrl`. (Writes a saved plan.)
  2. `check_room_layout`: verify a given arrangement against the rules. (Read-only.)
  3. `estimate_room_materials`: flooring, paint, baseboard quantities with waste factor and cost from supplied unit prices. (Read-only.)
- **Non-goals for MVP:** photo capture, photoreal renders (ChatGPT's own image model can style from the layout), multi-room floor plans, contractor marketplace.

### Aisle: wedding planner

- **Job:** build a **seating chart that provably satisfies every rule**, then a **day-of timeline**; budget later.
- **MVP tools (stable):**
  1. `plan_wedding_seating`: guests (groups, plus-ones, kids) + tables + rules (together, apart, head table, near/far from stage) → assignment, rule report, `planId`, `editUrl`.
  2. `check_wedding_seating`: verify a given arrangement. (Read-only.)
  3. `build_wedding_timeline`: fixed anchors (ceremony, travel, photos, dinner) → schedule with buffers and conflict warnings. (Read-only.)
- **Non-goals for MVP:** vendor marketplace, registry, budget tracker, guest RSVP site.

### Shared engine (`packages/engine`)

- **Seating:** assignment under hard rules (capacity, together, apart, fixed seats) and soft preferences, using constructive heuristics plus bounded local search, with an independent **verifier** that re-checks every rule on the final answer (the "proof" shown to the user). If rules are infeasible, report which and why instead of faking a result.
- **Layout:** rectangle placement with rotation, wall snapping, clearance polygons, door-swing arcs, and the same verifier pattern.
- **Performance budget:** Workers need a paid plan for long CPU time; keep tool calls under a hard iteration/time budget (target <1 s typical) and run the full-quality solve in the browser editor.
- **Determinism:** seeded randomness so results are reproducible in tests and review.

## 4. Phases and exit criteria

| Phase | Deliverable | Exit criteria (all must hold) |
|---|---|---|
| **P0** Plan and spike | This document; Workers-runtime MCP spike | Spike answers `initialize` and a tool call under `workerd` ✅ |
| **P1** Landing pages | Two landing sites + privacy, terms, support; waitlist endpoint; challenge route; Worker; sitemap | Builds clean; pages pass desktop/mobile screenshot review; waitlist stores and dedupes in local KV; privacy page states real data practices; no claims about unbuilt features |
| **P2** MVP engines | `packages/engine` seating + layout + verifier + unit tests; web editor v0 (static data) | Property tests: verifier agrees with solver on 1,000 random cases; infeasible cases reported correctly; materials math tested against hand calculations |
| **P3** Vertical slice | Per product: ChatGPT prompt → MCP tool → saved plan → widget → "Edit on web" → web editor loads and re-verifies → share/export | End-to-end browser test passes locally on Workers runtime; KV TTL and delete link work; widget tested through the SDK's AppBridge host |
| **P4** Plugin package + integration | `plugin.json`, `mcp.json`, skill, assets, ZIP builder with linter; 5+3 test cases run against the real server; demo script | Linter passes the doc's rules; tool-schema compatibility test; all 8 cases per product pass |
| **P5** Production readiness | Deploy config, secrets list, runbook, privacy review, monitoring, go-live checklist | Everything above green; remaining items are only ones requiring your accounts |

"Ready to test live" = P5 complete: I will have a deploy-ready repo and a short list of actions that only you can do.

## 5. Draft test cases (for `review.test_cases`)

**Roomwise positives:** (1) "Plan a 14x12 ft living room with a sofa, coffee table and TV unit" → `plan_room_layout`; (2) "Check my layout: sofa 6 inches from the coffee table" → `check_room_layout`, reports the gap rule failing; (3) "How much flooring and paint for this room?" → `estimate_room_materials`; (4) "Where can the dining table go so chairs can pull back?" → `plan_room_layout`; (5) "Can I fit a 90-inch sofa without blocking the door?" → `check_room_layout`.
**Roomwise negatives:** (1) "Redesign my room from this photo" (unsupported: asks to upload a photo/render); (2) "Approve my permit" (out of scope); (3) "Order the furniture" (no commerce).
**Aisle positives:** (1) "Seat 60 guests at tables of 8, keep the Smiths together and separate Alex and Jo" → `plan_wedding_seating`; (2) "Check this seating chart" → `check_wedding_seating`; (3) "Build a timeline for a 4pm ceremony" → `build_wedding_timeline`; (4) "Put my grandparents near the exit" → `plan_wedding_seating`; (5) "Why can't you seat all 12 rules?" with infeasible rules → explains the conflict.
**Aisle negatives:** (1) "Book a photographer" (out of scope); (2) "Send invitations" (unsupported); (3) "Charge my card for the venue" (no commerce).

## 6. Data handling (must match the privacy page)

- **Collected:** early-access email; plans created (room dimensions and furniture lists; wedding guest names, groups and rules); host request logs (IP, timestamp).
- **Not collected:** accounts, payment details, ad identifiers; no analytics in MVP.
- **Retention:** waitlist until you ask for deletion; plans **90 days after last edit** (stored in D1; a daily cron deletes expired rows); every plan has a separate **manage token** that allows edit and delete, while the shareable view link is read-only.
- **Recipients:** Cloudflare as host/processor; OpenAI receives what you type in ChatGPT under its own policy; nothing sold or shared for advertising.
- Wedding guest names are personal data about third parties: minimise (first name or initials accepted), unlisted ids, short TTL, delete control.

## 7. What only you can do (blockers, in order)

1. **Pick the publisher identity** and complete OpenAI individual/business verification.
2. **Buy or choose domains** and two hostnames (the MCP URL cannot be changed later without support).
3. **Cloudflare account**, a paid Workers plan if solver CPU needs it, and an API token (or run `wrangler deploy` yourself).
4. Public **contact/support email** and legal review of privacy/terms.
5. Record the **demo video**; paste the OpenAI **UI guidelines**, **plugin guidelines** and **MCP review requirements** pages.
6. A paid Claude plan if you also want the Claude directory.

## 8. Loop policy

Each pass: read this plan, advance the earliest unfinished phase, run the full test suite, commit and push, and record progress in `docs/plan/progress.md`.
Stop when P5 is complete (report the remaining user-only actions) or if a blocker needs your decision. Passes with nothing to do are marked no-op.

## 9. Risks

- **Review risk:** OpenAI's UI/guideline pages are unread; widget behaviour in ChatGPT is unverified until tested in developer mode.
- **Demand risk:** no search-volume evidence for these ideas yet; run the free checks (room layout / seating prompts in ChatGPT, Keyword Planner) in parallel.
- **Competition:** The Knot has a ChatGPT app; Zola/WeddingWire dominate wedding AI answers; RoomGPT-style tools dominate photo restyling. Our wedge is verified constraints and to-scale layout.
- **Correctness liability:** layout rules are rules of thumb, not building-code advice; say so.
- **Child/personal data:** guest names; keep data minimal.

# Progress log

## 2026-10-01: P0 and P1 complete

- **P0** Plan written (`docs/plan/app-generation-plan.md`). Spike confirmed an MCP server runs under the Workers runtime (`workerd`) via `createMcpHandler`.
- **P1** `planner/` workspace with a shared site kit and two branded landing sites (Roomwise, Aisle): landing, privacy, terms, support, sitemap, robots, CSP headers, KV waitlist (dedupe, honeypot, size limits), `/.well-known/openai-apps-challenge` route (404 until the secret is set).
  - Verified: `npm run test:landing` runs both apps on `workerd` and drives them in Chromium: 44 checks pass (waitlist behaviour, legal pages, CSP console-clean, mobile no-overflow). Screenshot review found and fixed three visual bugs the assertions missed (header button contrast, tiny illustration text, clipped dimension label).
- Pending your input: publisher name, contact email, domains (see plan section 7). Pages show placeholders until `PUBLISHER_NAME`, `CONTACT_EMAIL`, `SITE_URL` are set.

Next: P2 engine.

## 2026-10-01: P2 engine (in progress)

- `planner/packages/engine`: seating solver + independent verifier, layout solver + independent verifier (walkway widths measured with a widest-path search over a 2 in grid), materials estimator, SVG renderer. 18 tests pass, including property tests.
  - Seating: 150 random problems with a guaranteed hidden solution are all solved and verified; corrupting a solved chart is always detected; 250 guests / 30 tables solves in well under 1.5 s; infeasible rules are named, with the minimal set to relax.
  - Layout: walkway measurement checked against a known 40 in gap (within 4 in); hand-calculated materials match; 38 of 40 random rooms solved, the 2 unsolved report the exact failing rule (front clearance of a desk or storage unit).
- Found and fixed along the way: side tables were placed in front of sofas, not beside them; chairs sat diagonally to the coffee table.
- Remaining for P2: web editor v0.

## 2026-10-01: P2 and P3 complete (vertical slice for both products)

- **Servers:** each product has an MCP server on Workers with 3 stable tools, D1 plan storage (128-bit view id plus separate manage token, 90-day expiry refreshed on edit, 200 KB limit, daily purge cron) and a widget. Tests: `home.e2e` 8, `wedding.e2e` 7, `widgets.e2e` 17 (including hostile-name injection tests inside the sandboxed frame).
- **Web editors (the "Edit on web" half of the slice):**
  - Roomwise: drag, rotate, nudge furniture with live rule re-check, door/window editing, unit switching, materials panel, save / edit link / read-only share link / make a copy / delete, SVG download, print. 20 checks.
  - Aisle: guest list, tables, rules as one-line text, drag a guest to another seat (swap) or table (refused if full) with live re-verification, conflict panel with reasons, day-of timeline, CSV export (formula-safe), save / share / copy / delete. 31 checks.
  - Both: hostile names never inject markup, errors are explained in plain language, no horizontal scroll at phone width, no console or CSP errors. On phones the chart and toolbar now come before the form.
- Full suite now: engine 22, core plans 5, landing 44, home e2e 8, wedding e2e 7, widgets 17, home editor 20, wedding editor 31.

Next: P4 plugin packages, linter and review test cases.

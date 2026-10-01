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

## 2026-10-01: P4 and P5 complete (ready for a live test, pending your accounts)

- **P4:** `packages/plugin-kit` builds each plugin as a ZIP (plugin.json with `extensions.com.openai`, mcp.json with one streamable-http server, onboarding skill, SVG logos, real screenshots) and lints the ZIP against the submission page's rules (limits, HTTPS URLs, contrast, square icons, 5+3 cases, no credentials/apps/hooks, one server). Dev mode warns on placeholders; `--release` fails on them. A dry run with fake real values passes release mode, and standard `unzip -t` accepts the ZIPs.
- All 10 positive review cases (5 per plugin) are executed against the real servers on workerd. They found two real problems, both fixed: (1) the layout solver crammed a dining table against a wall, so ordinary rooms returned a layout the verifier rejected (the verifier was right; regression tests added); (2) nine timeline parameters had no descriptions (a model reads those to fill arguments), and I had guessed some defaults wrong, so the descriptions now read the defaults from the engine.
- Tool schemas are snapshotted; `npm run test:review` fails on breaking changes and lists changes OpenAI would hold for review.
- **P5:** `scripts/deploy.mjs` (build with the real hostname, deploy with custom domain, D1 migrations, challenge secret, smoke test), `scripts/smoke.mjs` (also tested locally, including its failure path), GitHub workflow (tests on push, manual deploy), `docs/plan/go-live.md` (ordered user-only steps, env reference, runbook, what is unverified), `docs/plan/demo-script.md`.
- Verified against Cloudflare docs: binding ids can be omitted (auto-provisioning), custom domains via `routes[].custom_domain`, the free plan's 10 ms CPU limit (so Workers Paid is required), 1 s startup limit, 64 MiB size limit (bundle is about 2 MB).
- Full suite: `npm run test:all` exits 0 (engine 23, core 5, plugin-kit 12, node:test e2e 26, plus landing, widgets, both editors).

**Loop stopped:** nothing further can be built or verified without your accounts or decisions. See `docs/plan/go-live.md`.

## 2026-10-01: spending protection

- Cloudflare has no hard spending cap (budget alerts are email-only and delayed), so the Workers now enforce daily caps themselves: 50 solver calls and 10,000 dynamic requests per product per day, 5 s CPU per call. Worst case across both products is 27.9M of the 30M CPU-ms included in the $5 plan; a unit test and the deploy script both enforce that the numbers fit. Details and honest limits: `docs/plan/cost-controls.md`.
- Tests: usage guard unit tests (14 in core), and an end-to-end test on workerd that proves exactly N requests are served then 429, with the challenge route, preflights and static pages unaffected.
- Alerts are dashboard-only and need you: budget alerts at $0.50 and $2.00 to szyk.adam@gmail.com (`go-live.md` step 3b).
- Test workers now share one startup helper (migrations plus high limits), so the landing test no longer starts its own.

## 2026-10-01: first real checkout found three bugs my machine hid

A fresh clone on macOS (with a space in the folder path) failed. Causes, all fixed and now covered by running the whole suite in a fresh clone under a path with a space:
- The repo-root `.gitignore` (a Python template) ignores any folder named `lib/`, so `scripts/lib/` was never pushed. Renamed to `scripts/cloudflare/`.
- Scripts turned file URLs into paths with `URL.pathname`, which leaves spaces as `%20`. Now `fileURLToPath`.
- `test:all` ran the typecheck before the build that creates the git-ignored widget files, so it failed on any new checkout (and would have failed in CI).
Also: `npm run deploy` is now a single interactive command (hidden token input, format validation, works in bash and zsh), tested through a pseudo-terminal.

## 2026-10-01: first live deploy

Both products deployed to Cloudflare Workers (workers.dev, Workers Paid) with D1 and KV provisioned, migrations applied and the post-deploy smoke test passing (28 checks each, including all review cases against the live servers). A brand-new workers.dev address needed up to about 16 seconds before it answered, so the smoke test now waits. Plugin ZIPs built.
Added: `npm run credentials` (token in the OS keychain, account id in a private config file), `npm run set-challenge`, `npm run prompts`, token permission preflight, secret scanner and commit hook. The macOS Keychain path is covered by tests that mock the `security` command, not by a run on a Mac.

## 2026-10-01: listing copy pass against OpenAI's plugin guidelines

- Rewrote both listings, skills and all six tool descriptions around the terms people use (home redesign, remodel, house decor, floor plan, furniture layout; wedding seating chart, table plan, wedding timeline) while keeping every claim true: Roomwise states up front that it works from measurements, not photos, and does not choose decor.
- Applied the guideline rules available to me: no generic single-word names (Aisle is now "Aisle Seating Chart"), no comparisons or unverifiable claims, no pricing or promotion wording, tool descriptions start "Use this when" and say when not to use the tool. The linter and the review tests now enforce these.
- The guidelines PDF supplied contained only the first screen of the page (overview), not the rules sections, so the safety, privacy, commerce, MCP and skills sections have not been checked yet.
- No search-volume data was used or available; the keywords are the obvious plain-language terms, not measured ones.

## 2026-10-01: hosted demo walkthrough

Added a public, unindexed `/demo/` page per product that plays the captioned walkthrough (real tool calls, widget and editor against the live server) from the product's own site; the page says plainly that it is not a ChatGPT recording. Static assets are free and need no sign-in, so the link works for reviewers without Google Drive or YouTube. The recording inside ChatGPT still has to be made by the account owner.

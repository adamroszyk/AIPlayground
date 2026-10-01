# Final shortlist

Date: 2026-10-01. Synthesises every research round in `docs/research/`.
Evidence is snippet-level throughout; nothing was verified against a primary page.

## What OpenAI's submission rules add (secondhand)

I could **not** read [developers.openai.com/plugins/deploy/submission](https://developers.openai.com/plugins/deploy/submission): that domain and every mirror I tried were blocked.
Search snippets of it and its sibling pages ([app review](https://developers.openai.com/plugins/deploy/app-review), [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines),
[submission errors](https://developers.openai.com/plugins/deploy/submission-errors)) report the following. **Please paste the page if you want me to check these against the source.**

| Requirement (as reported) | What it means for us |
|---|---|
| Submit at platform.openai.com; a plugin is skills-only, app-only (MCP) or app + skills | Our MCP server is "app-only". Skills-only plugins (reusable workflows, no server) are a cheap extra |
| **Identity verification** in the OpenAI Platform dashboard, individual or business, for the name shown in the directory; `api.apps.write` permission | **Blocker for everything.** Decide a publisher name and entity now |
| Remote MCP server on a **publicly accessible domain**; if it returns UI, a **CSP** listing the exact domains it fetches from | Deploy needed. Our QR widget fetches nothing external, so the CSP is trivial |
| **OAuth 2.1** for authenticated servers | Our tools need no login; a roster product that saves schedules will need accounts |
| **Exactly five positive and three negative test cases**, reproducible with a supplied account and fixtures; video walkthrough URL; release notes | Deterministic engines make this easy. A solver's "infeasible rules" case is a natural negative test |
| Privacy policy: categories of personal data, purposes, recipients, retention, user controls | Our draft covers most; it must add user controls and real contact details |
| Must work on **desktop and mobile**, including UI | Widgets need mobile testing |
| Directory is held to a **higher bar** than workspace installs; **trial or demo plugins are not accepted** | Ship complete behaviour, not a teaser |
| A plugin must **not be a worse version** of what the website offers and must not add ChatGPT-specific fees | Build one engine and expose it to both web and plugin (our architecture) |
| Prohibited categories (adult, gambling, drugs, Rx, counterfeit, fraud tools, malware) | None of the shortlist is affected |
| Ranking and recommendation "improved" at DevDay; rules not documented; one source says retention is favoured | **Repeat-use products rank better**, which favours recurring workflows over one-off calculators |

### Verified from your PDF (firsthand, but only one page)

The uploaded PDF contains **one page**: a screenshot of the "Update to your MCP server" section. Its table of contents confirms the flow:
1. Upload your plugin ZIP → 2. Review checks and resolve issues → 3. Submit for review → 4. Publish your approved plugin → update a published plugin → **update to your MCP server** → automatically provide submission and review information.
The sidebar shows the doc set: plugin architecture, skills, MCP server, brainstorm use cases, define tools, build an MCP server, add UI (optional), add events (optional), extensions, authenticate users, build skills, package your plugin, examples.
**Steps 1-4 themselves (requirements, test cases, verification) are not in the PDF**, so the secondhand table above is still unverified. What the page does say:

- There is an **automated MCP scan** of your server. You can **rescan** after server changes; rescan can be unavailable during another scan, an active appeal, or when the plugin is not eligible for scanning.
- Per-tool issue flow: open **Issues** → select the affected tool → compare **Held update** (the metadata that was evaluated) with **Live definition** (what is currently in use) → **Copy issues** → fix the metadata or implementation on your server and deploy → **Rescan**.
- **Tool changes are evaluated independently.** A flagged change does not necessarily block other tool updates. **New tools remain unavailable until approved.** Existing tools **keep their previously approved metadata** when an update is held. Removals take effect after a scan.
- You must **keep the server compatible with the currently approved tool schemas** until updated metadata is live.
- You can **appeal** an automated finding; the review team considers the held changes together, and fixing the server and rescanning is usually faster.

**What this changes for us:**

- **Tool names, descriptions and schemas are reviewed, and later edits go through the same gate.** The advice to tune descriptions to the phrases people type is therefore slow to iterate on: each wording change can sit as a held update, and new tools stay unavailable until approved.
- **Design the tool surface once, and keep it small and stable.** Prefer a few general tools with optional parameters (additive changes only) over many narrow ones. For the roster product that means something like `build_schedule`, `check_schedule`, `adjust_schedule`, not one tool per industry. This favours the citation verifier (two or three stable tools) as the first thing to submit, and means the roster's tool schema needs more up-front design.
- **Our server must stay backward compatible** with whatever was approved, so schema versioning is part of the build, not an afterthought.
- Extensions, events and "Sign in with ChatGPT" exist as separate doc sections; I have not seen their content.

Claude's directory (read from Anthropic's own docs earlier) needs a privacy policy, annotated tools, HTTPS Streamable HTTP, and a paid plan to submit. Grok is a pull request to its plugin marketplace.

## Decision criteria

Score 1-5 each (higher is better): **Chat can't** (needs a real tool), **Channel fit** (matches the pattern that actually produced traffic: a task query + many long-tail pages + a tool hook),
**Open field**, **Retention** (repeat use, which ranking reportedly favours), **Build** (ease for a small AI-assisted team), **Submission** (low policy/verification risk).
All scores are my judgement.

| Rank | Idea | Chat can't | Channel fit | Open field | Retention | Build | Submission | **/30** |
|---|---|---|---|---|---|---|---|---|
| 1 | **Shift-roster solver** (+ seating chart as second vertical) | 5 | 5 | 4 | 5 | 3 | 4 | **26** |
| 2 | **Citation verifier / generator** (Crossref) | 4 | 4 | 2 | 3 | 4 | 5 | **22** |
| 3 | Term-sheet comparison + exit-waterfall explorer | 3 | 3 | 3 | 2 | 4 | 4 | 19 |
| 4 | Home electrification planner (solar, battery, heat pump, EV) | 4 | 4 | 3 | 2 | 2 | 3 | 18 |
| 5 | Existing `toolbox/` calculators (age/date, mortgage what-if, QR, words, password) | 2 | 2 | 1 | 2 | 5 | 5 | 17 |

### 1. Shift-roster solver (flagship)

- **What:** describe staff, shifts and rules in plain language; a CP-SAT solver builds the weekly schedule and shows a verified "N of N rules satisfied" badge; edit by chat or drag; export xlsx/PDF/ICS. Second vertical: event seating.
- **Why chat can't:** models write plausible schedules that break rules (TravelPlanner: GPT-4 0.6% on all-constraints tasks, a 2024 benchmark; a vendor test shows ChatGPT violating rest and day limits). Newer models are better, so the 20-minute test below is mandatory.
- **Why the channel fits:** Tally's 25% of signups came from niche landing pages and "free alternative" positioning. "Restaurant shift schedule template", "nurse 12-hour schedule generator", "wedding seating chart maker" are the same long-tail shape, with a tool the user cannot replace by chatting. (My inference; no lane tested it.)
- **Why retention is real:** it is the only recurring weekly workflow on the list, which suits a retention-weighted ranking and the "do by hand every week" heuristic.
- **Competition:** Homebase, Deputy, When I Work, 7shifts (staff apps); Timefold/Solvice (developer APIs). No chat-native solver app found.
- **Risks:** accounts and saved data (OAuth, GDPR), incumbents with free tiers, solver correctness is the product.
- **Vertical slice:** the roster flow in `docs/research/ambitious-ideas.md`; reuses `toolbox/` MCP server, widget pipeline and site builder.

### 2. Citation verifier / generator (fast, low-risk second bet)

- **What:** paste a DOI, URL or title (or a list of AI-suggested references) → verified, formatted APA/MLA/Chicago + BibTeX, with "could not verify" flags.
- **Evidence:** best-sourced web demand of the new ideas ("apa citation generator" ~693K, "citation machine" ~437K, Ahrefs via snippet). Value is checking AI-hallucinated references against Crossref, which chat cannot do itself.
- **Competition:** `crossref-cite-mcp`, Scribbr, Citation Machine, Zotero. Crowded on the web; not found in official directories.
- **Fit/risks:** no files, no accounts, trivial submission; seasonal; ChatGPT can browse. Retention is moderate (every assignment).
- **Slice:** student asks ChatGPT for sources → tool resolves each against Crossref → verified references with flags. ~2-3 days.

### 3. Term-sheet + exit-waterfall explorer (cheap founder wedge)

- Compare offers and see payouts by class across exit values. Carta, Pulley and Foresight have free web tools; none found in chat. Small market, episodic use (retention 2), but cheap and founder-native. Needs "not legal/financial advice" language.

### 4. Home electrification planner (open lane, higher upkeep)

- Solar + battery + heat pump + EV payback with real irradiance (NREL PVWatts), local rates and incentives; location pages ("solar payback in Austin") are natural long-tail. Many web calculators, no chat-native planner found. Risks: incentive and rate data goes stale, accuracy liability, one-off use (low retention).

### 5. Existing `toolbox/` calculators (keep as the control experiment)

- Already built and tested. Evidence says calculators are a weak ChatGPT channel (Calculator.net ~0.043% and Omni ~0.028% of traffic from ChatGPT, Semrush estimates), so do not invest further. They still serve as the cheapest way to **measure** the real surfacing rate once deployed.

## Kill list (do not build now)

Poko Motion / video (ChatCut, Remotion plugin, Runway, Orshot already in ChatGPT) · text-to-CAD (AdamCAD, Zoo) · design canvas (MagicPath, Figma, Canva) · Typeform/Calendly/Google Forms competitors (official connectors exist) ·
agent email/social/payments/phone (funded incumbents, compliance) · agentic newsletter/blog (beehiiv, Google spam policy) · geospatial (Felt, Mapbox, CARTO) · synthetic-user testing (Uxia, Maze, UserTesting) · meal planner (Eat This Much, Cronometer) · provenance viewer (Reducto, NotebookLM) · in-chat checkout (failed).

## Validation gates (cheap, before writing product code)

1. **Roster:** give current ChatGPT five realistic scheduling prompts and count rule violations. If near zero, drop #1 and promote #2.
2. **Keyword Planner** on "shift schedule maker", "employee schedule generator", "seating chart maker", "apa citation generator", "doi to apa", "exit waterfall calculator", "solar payback calculator".
3. **Five conversations** with shift managers (restaurants, clinics, retail).
4. **Deploy the five existing tools**, add analytics for `chatgpt.com` referrals and `OAI-SearchBot` crawls, and look at real numbers after 4-6 weeks.

## Open items that only you can resolve

- **Publisher identity** (name and entity) for OpenAI verification, a public contact email, and a public domain.
- A paid Claude plan to submit to Claude's directory.
- Paste the OpenAI submission page (or confirm access) so I can verify the table above.

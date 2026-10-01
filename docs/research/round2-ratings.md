# Round 2: the tweet, ChatGPT demand data, and ratings of 20 ideas

Date: 2026-10-01. Method: five parallel research agents (agent infrastructure; forms/scheduling alternatives; agentic content;
"do it by hand weekly" tools; ChatGPT demand data) plus my own checks. **Almost everything comes from search-result snippets**: openai.com,
x.com, semrush.com, ahrefs.com, nber.org, techcrunch.com and many blogs were blocked from this environment, so no primary page was read.
Treat every figure as unverified.

## 1. The tweet, claim by claim

Source tweet by Greg Isenberg (x.com blocked here; the text was pasted by you).

| Claim | What I found | Grade |
|---|---|---|
| "1.2 billion weekly users" | Reported by press as OpenAI's own DevDay figure ([The Decoder](https://the-decoder.com/chatgpt-now-reaches-1-2-billion-people-every-week-openai-says/), PYMNTS). Earlier: 900M (Feb 2026). No independent audit. These are weekly *users*, not paying users. | B |
| "As of yesterday, ChatGPT recommends plugins in the middle of conversations" | Secondary outlets on 2026-09-29 describe in-conversation app suggestions, but several phrase it as "will soon be able to". I could not confirm it is live for everyone. | B-, partly unconfirmed |
| "Free distribution" / "most people miss it" | Opinion. Bloomberg (2026-03-30, paywalled, snippet only) reports ~300 apps six months in with partners seeing little traffic, hard discovery and almost no analytics. | Contradicted by the one data point I found |
| "Millions of questions with no plugin to recommend. Each is an empty slot." | Unsupported inference. For the simple tools we examined, several community MCP servers already exist (section 3). Whether an *empty slot* gets filled depends on a ranking OpenAI says it changed and has not documented. | Unsupported |
| "Crowded in 12 months" | Opinion. Already crowded for generic utilities in MCP registries. | Opinion |
| Directory is called "plugins" | A blog says the App Directory became the Plugin Directory on 2026-07-09. | C |
| Ranking | Press says OpenAI "changed how plugins are ranked and recommended"; one snippet says retention favours tools people keep using. Developer influence is undocumented. Another source says the directory name weighs most and long-tail keywords don't work reliably. | C |
| Monetization | None confirmed. | Unknown |

**Net:** the platform shift is real and large, but "free, empty slots, write your description with the phrases people type" is an untested playbook,
and the sparse available evidence leans against it. The sensible reading is *cheap experiment*, not *sure thing*.

## 2. "Search volume on ChatGPT": what exists and how reliable

**There is no reliable per-keyword ChatGPT search volume.** OpenAI does not publish it; vendors estimate it.

| Source | What it is | Reliability |
|---|---|---|
| NBER WP 34255, "How People Use ChatGPT" (primary) | ~2.5B messages/day; ~28% practical guidance, ~24% information seeking, ~24% writing; coding ~4%; ~73% non-work (June 2025). Category level only, no keywords. | A |
| Semrush AI Visibility / Prompt Research | Clickstream panel, topic-level normalized volume. Brand reports use synthetic prompts. | B-: probabilistic |
| Profound Prompt Volumes | Opt-in consumer panel, clustered prompts, debiased. Most prompt-level, vendor-reported. | B-: no independent validation found |
| Ahrefs Brand Radar | Static library seeded from Google PAA and keyword volumes. A Google-demand proxy, not observed ChatGPT demand. | C for this purpose |
| Similarweb | Panel; reviewers cite large errors on small segments. | C |
| Keyword blogs ("X has 5M searches") | Unnamed tools, no method, region unknown. | C |

No independent accuracy test of any vendor was found. Best practical method (from the research agent, error bars ≥10x each way):
get the **Google** volume for the same task (Keyword Planner, free) → multiply by a guessed 0.05-0.3 ChatGPT/Google ratio (unvalidated) → remove tasks
ChatGPT already does without a tool → multiply by the unknown share where *your* app is surfaced. Use it to **rank ideas against each other, never to forecast**.
Rough scale: if 1-5% of ~2.5B daily messages need a real tool, that is ~25-125M/day across *all* niches (a guess), so any one idea gets a small slice.

## 3. Correction to my earlier note

I previously wrote that password, age/date and mortgage "looked open". That was true only of the **official ChatGPT directory** snippets I saw.
Checked properly across MCP registries (Glama, Apify, npm, GitHub) they are **not** empty:

- Mortgage/loan: `mcp-amortization`, `@thicket-team/mcp-calculators`, `loancalculatormcp.com`, `jibbs1703/Financial-Tools-MCP`, several Apify actors.
- Paycheck/take-home: `digitalcalculator.info` (5 financial calculators), Thicket.
- Password: `alfredang/strong-password-generator-mcp`, `dytavan/MCP-Password`.
- Citations: `crossref-cite-mcp` (PyPI), an Apify Crossref citation actor. The agent's "no citation MCP found" was wrong.
- QR and word counter: already in the official ChatGPT directory (previous round).

Caveat: registry presence is not the same as official-directory presence or user traffic. But it kills the idea that features are the moat.
Every research lane reached the same conclusion: **the moat is distribution and ranking, not functionality.**

## 4. Ratings

Each criterion 1-5. **Score = Demand×2 + Open field×2 + Chat edge + Ease + Low risk** (max 40). Demand and open field are double-weighted because they decide whether anyone finds and uses it.
*Demand* = quality of evidence of search interest (1 = none found, 3 = a low-credibility figure, 5 = strong sourced figure; nothing earned 5).
*Open field* = how few direct competitors in official directories and MCP registries. *Chat edge* = chat genuinely needs the tool (exact math, real file, live data).
*Ease* = for a small AI-assisted team. *Low risk* = legal, platform, abuse. All scores are my judgement from the agents' snippet-level evidence.

| Rank | Idea | D | O | E | Ease | Risk | **Score** | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | **Age & date calculator** (built) | 3 | 3 | 5 | 5 | 5 | **27** | "5M+" age-calculator figure is a marketing-page claim; only generic date/time MCPs found |
| 2 | **Citation generator** (DOI/URL → APA/MLA/Chicago via Crossref) | 4 | 2 | 4 | 4 | 4 | **24** | "apa citation generator" 693K, "citation machine" 437K (Ahrefs via snippet). Fixes hallucinated references. Crossref MCP exists. Seasonal |
| 3 | Password generator (built) | 3 | 2 | 5 | 5 | 3 | 23 | Several MCPs; passwords land in chat history |
| 3 | Mortgage / loan (built) | 4 | 1 | 5 | 5 | 3 | 23 | Six+ MCPs, but biggest verified-ish commercial intent |
| 3 | Word counter (built) | 3 | 1 | 5 | 5 | 5 | 23 | Already in official directory |
| 3 | IRS mileage / deduction calculator | 1 | 4 | 4 | 5 | 4 | 23 | Rate changed mid-year (76¢ from July 2026); no MCP found by one agent, unverified. Tiny niche |
| 6 | QR code (built) | 3 | 1 | 4 | 5 | 5 | 22 | Three QR apps already in the directory |
| 7 | Paycheck / hourly-to-salary | 3 | 2 | 5 | 3 | 3 | 21 | "hourly to salary" ~33K US (low cred). Exact tax tables need yearly upkeep and carry accuracy liability |
| 8 | Niche invoice/quote PDF | 3 | 1 | 3 | 4 | 4 | 19 | Proven demand ("free invoice generator" ~22K), crowded; needs a trade/country angle |
| 8 | Bank statement PDF → Excel | 4 | 1 | 4 | 2 | 3 | 19 | Biggest demand, file handling is fragile in chat apps |
| 10 | Scheduling poll (Doodle gap) | 1 | 3 | 4 | 3 | 3 | 18 | Doodle has no ChatGPT app; indie Timergy exists; demand unmeasured |
| 11 | Typeform competitor | 2 | 1 | 3 | 2 | 2 | 13 | Typeform, Jotform, Tally, SurveyMonkey all have official connectors |
| 11 | Calendly competitor | 2 | 1 | 2 | 2 | 3 | 13 | Calendly has an official MCP + ChatGPT app. "calendly alternative" ~1.9K/mo (low cred) |
| 13 | AI-based calendar | 2 | 1 | 2 | 3 | 3 | 13 | Reclaim, Motion exist; Clockwise shut down Mar 2026; ChatGPT/Claude have native calendar connectors |
| 14 | Emails for AI agents | 1 | 1 | 3 | 2 | 2 | 11 | AgentMail (YC, $6M seed) already has an MCP server. Deliverability/abuse |
| 15 | Agentic newsletter | 1 | 1 | 2 | 2 | 2 | 10 | beehiiv ships an official MCP + agent; Mailchimp in directory; you'd own deliverability |
| 16 | Agentic blogs | 1 | 1 | 1 | 3 | 1 | 9 | Google's Aug 2026 spam update targets scaled content (SEO-blog claim, not Google's page) |
| 17 | Social profiles for AI agents | 1 | 1 | 2 | 3 | 1 | 8 | Meta bought Moltbook (Mar 2026); bot accounts on real platforms violate ToS |

Other agent-infrastructure ideas (phone numbers, payments/wallets, browser sessions, identity) were each rated 5/5 difficulty by the research agent with funded incumbents; not scored.

### How much to trust these numbers

Low. Demand evidence is the weakest column everywhere (no figure above is methodology-backed), the ranking inside 18-24 is noise, and the combined uncertainty on real
ChatGPT traffic is ~100x per the method above. What the table *can* support: **the gap between the top ~8 and the bottom ~9 is large and consistent across all five research lanes.**
Your proposed ideas (agent email/social, AI calendar, Typeform/Calendly competitors, agentic newsletter/blog) rank at the bottom for the same reasons each time:
funded incumbents with official connectors, B2B/compliance burdens, or platform-policy risk, and no evidence people search for them in volume.

## 5. What I would do (recommendation, not a decision)

1. **Stop adding ideas; run Greg's own experiment with what exists.** The tweet's plan ("ship 5, see which gets picked up, double down") is the one part that survives scrutiny, because nobody can predict surfacing. We already have five.
2. **Add one:** the citation generator. Highest sourced demand among no-file ideas, genuine tool-need, no files, and Crossref is free.
3. **Measure before polishing:** log invocation *counts per tool* server-side (no inputs, which is compatible with the privacy policy but the policy must be updated to say so), and track directory impressions where the dashboards allow it.
4. **Before any further build**, spend 30 minutes in Google Keyword Planner on the top ~8 names, which is the only free way to replace snippet-grade volumes with real ones.
5. **Poko Motion and the agent-infrastructure ideas:** do not start. Revisit only if a volume check or a concrete buyer says otherwise.

## Sources (all snippet-level unless noted)

[The Decoder, 1.2B users](https://the-decoder.com/chatgpt-now-reaches-1-2-billion-people-every-week-openai-says/) ·
[NBER WP 34255](https://www.nber.org/system/files/working_papers/w34255/w34255.pdf) ·
[Bloomberg, ChatGPT app store results](https://www.bloomberg.com/news/articles/2026-03-30/openai-s-chatgpt-app-store-took-aim-at-apple-but-results-lag-so-far) ·
[TechCrunch, DevDay plugins](https://techcrunch.com/2026/09/29/openai-expands-chatgpts-plugins-with-app-like-interfaces-and-automations/) ·
[Profound prompt volumes](https://www.tryprofound.com/blog/prompt-volumes-general-availability) ·
[Ahrefs Brand Radar methodology](https://ahrefs.com/blog/brand-radar-methodology/) ·
[Semrush AI Visibility data](https://www.semrush.com/kb/1607-semrush-ai-visibility-data) ·
[crossref-cite-mcp](https://pypi.org/project/crossref-cite-mcp/) ·
[mcp-amortization](https://github.com/theluckystrike/mcp-amortization) ·
[Typeform MCP](https://www.typeform.com/mcp) ·
[Calendly AI tools](https://calendly.com/help/connect-calendly-to-your-ai-tools) ·
[AgentMail seed](https://techcrunch.com/2026/03/10/agentmail-raises-6m-to-build-an-email-service-for-ai-agents/) ·
[beehiiv MCP](https://www.beehiiv.com/features/mcp/getting-started) ·
[Meta/Moltbook](https://www.cnbc.com/2026/03/10/meta-social-networks-ai-agents-moltbook-acquisition.html).

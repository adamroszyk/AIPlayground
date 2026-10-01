# Who actually gets traffic from ChatGPT? A ten-lane review

Date: 2026-10-01. Method: ten parallel research agents, one source type each (founder claims, agency case studies, well-known companies, app-directory developers,
GPT Store / 2023 plugins, free-tool sites, referral-traffic studies, ecommerce/local, dev tools, fastest growth + skeptics).

## Read this first: how reliable is any of it?

- **No agent could open a primary page.** x.com, openai.com, semrush.com, ahrefs.com, bloomberg.com, dev.to, medium and most vendor sites were blocked. Every figure is a **search-result snippet** (AI-summarised), unverified against its source.
- **Every agent exhausted a 200-call search budget** and most found fewer than the 12-15 businesses asked for. I did not pad.
- **Count.** About **58 named businesses** surfaced (plus ~8 anonymous). Only about **16 gave a first-party figure** of their own (grade A), and about a dozen of those isolate ChatGPT from other assistants. The rest are agency/vendor case studies (grade C), visibility-only metrics, or have no number.
  So the honest answer to "50-100 startups claiming ChatGPT traffic" is: 58 names, ~16 real first-party numbers, none audited.
- **Grades:** A = the business states its own number; B = reputable outlet or study; C = vendor/agency marketing, anonymous, or no number.
- **Mechanism matters.** (a) cited in ChatGPT answers and clicked, (b) app/plugin directory, (c) GPT Store, (d) chatgpt.com referral of unknown cause, (e) in-chat checkout, (f) recommended by coding agents.

## 1. The strongest first-party claims

| Business | What it sells | Claim | When | Mechanism | Grade | Caveat |
|---|---|---|---|---|---|---|
| Vercel | hosting | CEO: ChatGPT refers **10%** of new signups; reportedly <1% (Oct 2024) → 4.8% (Mar 2025) → 10% (Apr 2025) | Apr 2025 | a | A | Tweet seen as snippet; no 2026 update found |
| Tally | free form builder (8 people) | Co-founder: ChatGPT **25%** of new signups in ~2 months; $3M ARR 5 months early | Jun 2025 | a | A | Short window; an unverified "44% of ~40K signups from AI assistants" also circulates |
| Japanese freelance marketplace (name unclear) | marketplace | ChatGPT **3.7% (Apr) → 24.5% (Sep) of new signups**, 33% in one week | Sep 2026 | a | A | Other lane called it a job board; author ties a 1.7x jump to OpenAI crawling JS from ~Sep 25 |
| Chatbase | AI support agents (~$8-10M ARR) | **37%** of new signups from LLM recommendation, highest converting | Sep (2026?) | a | A | All LLMs, not ChatGPT alone |
| Zigpoll | Shopify survey app (solo founder) | ~14% of signups from ChatGPT/Claude/Gemini | 2026 | a/d | A/B | Self-attribution via onboarding question |
| Ahrefs | SEO software | AI search 0.5% of visits but **12.1% of signups** | Jun 2025 | d | A | Very AI-friendly audience; repackaged wrongly as a general "23x" |
| Webflow | site builder | LLM share of signups ~4% → 8% (up to "10%" in other sources); 24% conversion vs 4% non-brand SEO | 2025 | a | B- | Written by agencies Graphite/AirOps; figures conflict |
| LocalPDF | in-browser PDF toolkit | ChatGPT ~**50%** of visitors vs ~45% Google; 2x conversion (maker's claim) | ~Dec 2025 | a | A | Visitors, not signups; tiny site |
| QuickTools.one | in-browser free tools | ChatGPT **71-75%** of traffic by weeks 4-8 (~1,080 visitors total) | ~Dec 2025 | a/d | A | Tiny; no revenue |
| HackMyIP | IP/privacy toolkit + API | 157 ChatGPT sessions vs 44 Google in 28 days | 2026 | a | A | Author credits `llms.txt`, which large studies found ineffective |
| AIToolsRecap | AI-tool comparison site | 9,900 users in 30 days; 78% "direct", 12% attributed AI | Apr 2026 | a/d | A | Comparison roundups reportedly cited; single-brand explainers not |
| Image-authenticity checker, Apple Watch wallpaper site | tools / content | ~48% of users; ~20 ChatGPT vs 1 Google sessions/week | 2026 | a | A | Unnamed; tiny volumes; wallpaper site had been deindexed by Google |
| Consensus | AI research search | **100K+ users in 4 days** via its custom GPT | Nov 2023 | c | A | GPT Store launch window; no repeat found |
| Canva | design | 12M+ designs via its MCP server across ChatGPT/Claude/Copilot; usage +60% MoM | Feb 2026 | b | A/B | Not ChatGPT-only |
| Etsy | marketplace | ChatGPT >20% of *referral* traffic but **<1% of total traffic** | 2025-26 | d | B | Referral share ≠ share of visits |
| Walmart | retail | ~20% of referrals from ChatGPT; in-ChatGPT checkout converted **3x worse** than click-out | Mar 2026 | d/e | B | Instant Checkout later wound down |

Vendor/agency claims (grade C, mostly visibility not traffic): Runpod "4x paying customers in ~90 days" (Scrunch), AutoRFP.ai "one-third of demos" (AthenaHQ),
Zapier "~25% of signups influenced" (Profound), Ramp visibility 3.2% → 22.2% (Profound), Popl, Rootly, Yonder, 1840 & Co., Smart Rent, NoGood, Akamai, IEEE Spectrum, UV Blocker, DI ORO, several anonymous law-firm and pharmacy clients.

## 2. What the numbers say about the channel

| Question | Best-supported answer |
|---|---|
| ChatGPT's share of a typical site's traffic | ~0.2-1% of sessions (SE Ranking: 0.23% of referrals Apr 2026, 0.32% May; Cloudflare-based data via aggregator: 0.91% Jul → 0.53% Aug). Software/legal ~1.5-2%. Above ~3% is an outlier or self-report |
| Conversion vs Google | **Not established.** Ahrefs 23x (own site), Seer ~9x (one client), Semrush 4.4x (modelled), Visibility Labs +31% (94 ecommerce sites), Amsive no significant difference (54 sites), Adobe -38% (2025) → +54% (2026) |
| Trend | Volatile, not steady growth: +150% after OpenAI's May 7 2026 link change, then fading; -52% in Jul 2025 and Nov 2025; Reddit citations collapsed Aug 2026 |
| Does optimisation cause the growth? | One causal study (Glasp, arXiv) found a 1.82x effect but a failed placebo test; authors say headline multiples overstate the effect, mostly platform tailwind |
| Who gets clicks | Concentrated: >30% of outbound clicks to 10 domains; Reddit/Wikipedia/Amazon/Etsy dominate |
| Attribution | ~70% of AI visits arrive as "direct" (vendor figure), so ChatGPT may be undercounted *and* unverifiable |
| Demand ceiling | Google handles ~373x more search-like queries than ChatGPT (SparkToro/Datos) |
| Directory/app channel | Thin: only Canva has a usage number; Bloomberg (Mar 2026) says ~300 apps, little traffic; directory grew to ~1,624 apps by July while demand lagged |
| GPT Store / 2023 plugins | Long tail dead (~300 of 65K GPTs with meaningful usage, unverified); plugins shut down ~13 months after launch; revenue share never broadly launched |
| In-chat checkout | Failed (Walmart 3x worse conversion; <15 Shopify merchants went live) |

## 3. What works (patterns that recur across lanes)

1. **Be the default answer to a task query.** Vercel ("how do I deploy"), Tally ("free alternative to Typeform"), Chatbase, Zigpoll: established or specialist products that answer a concrete "which tool" question.
2. **Big libraries of narrow pages.** Webflow's ~1,500 optimised template pages, Zapier's integration pages, Tally's niche landing pages (e.g. "free form tool for construction workers in Kentucky"), the marketplace's job pages once crawlers rendered them.
3. **Comparison / "alternatives" / "best X for Y" pages** (Tally, Ramp, AIToolsRecap). Vendor-reported, but the pattern recurs.
4. **A hook ChatGPT cannot replicate**: real file processing or in-browser privacy (LocalPDF, QuickTools, HackMyIP), not plain arithmetic.
5. **Being crawlable.** The Japanese marketplace's jump followed OpenAI's crawler rendering JavaScript.
6. **Third-party mentions help but are volatile** (Tally credits Reddit; Reddit's share collapsed in Aug 2026).
7. **Does not work as claimed:** `llms.txt` (300K-domain study found no link to citations; ~97% of files got zero traffic in one study).

## 4. Where growth was fastest (and why to discount it)

| Case | Speed | Discount |
|---|---|---|
| Consensus | 100K users in 4 days | 2023 GPT Store launch + featured placement; not repeated |
| Tally | 25% of signups in ~2 months | Founder claim, short window |
| Japanese marketplace | 3.7% → 24.5% in 5 months, 33% in a week | Coincides with a crawler change |
| Vercel | <1% → 10% in ~6 months | Secondhand early data points |
| QuickTools | 71% of traffic by week 4 | ~1,000 visitors total |
| Runpod | 4x paying customers in ~90 days | Vendor case study |
| Ramp | visibility 7x in 1 month | Visibility, not traffic |

Pattern: the fastest jumps line up with **platform events** (GPT Store launch, May 7 2026 link change, Sep 2026 JS crawling). Timing and luck matter at least as much as tactics.

## 5. Where there is room, and where there isn't

**Room (evidence is thin; partly inference):**

- Task-specific software and micro-SaaS with **long-tail "X for Y" queries** (Tally, Zigpoll, Chatbase pattern). SaaS citations are fragmented (top-10 domains ~28% of citations vs ~71% in healthcare).
- **Tools that need real processing or live data** (files, images, current rates, jurisdiction rules), which chat cannot do inline.
- **Challenger "alternative to incumbent" positioning**: Tally is the proof.
- Smaller languages have fewer sources per answer (inference; also less usage).

**Saturated or hostile:**

- Travel, health, finance (user-generated or government sources dominate); head-term "best X" listicles (also the manipulation target).
- Locked dev defaults: Claude Code picks Stripe 91%, Vercel 100% of JS deploys, GitHub Actions 94%.
- **Simple calculators:** Calculator.net gets ~26K ChatGPT visits (0.043% of traffic) and Omni Calculator ~4K (0.028%) per Semrush estimates; ChatGPT does the arithmetic itself, and its zero-citation rate reportedly doubled (28% → 48%) in March.
- In-chat checkout and the generic app long tail.

## 6. What this means for our `toolbox/` and our next idea

1. **Our five tools match the weak profile.** QR, word counter, password, age/date and basic mortgage are things ChatGPT answers inline. The two biggest calculator sites get <0.05% of traffic from ChatGPT. Treat them as a small experiment, not the plan.
2. **The evidence favours the website/citation channel over app listings.** The best-evidenced wins (Tally, Vercel, Webflow) came from being cited in ChatGPT *search answers*, not from directory apps. Our earlier emphasis on the plugin store is the less-evidenced bet.
3. **The proven pattern is a product, not a calculator:** a free-tier tool + a large library of niche template/landing pages + comparison pages.
4. **That strengthens the constraint-solver idea (my inference).** "Restaurant shift schedule template", "nurse 12-hour schedule generator", "wedding seating chart maker by table size" are exactly Tally-style long-tail pages, and ChatGPT's weakness (verifiably satisfying constraints) gives people a reason to click through to a real tool.
5. **Measure before betting.** Log `chatgpt.com` referrals and `OAI-SearchBot` crawls in our own analytics, and track "direct" traffic carefully.

## Caveats

Survivorship bias is severe (founders post wins, not misses); most "case studies" are vendor marketing; attribution is unreliable in both directions; the channel is volatile and controlled by OpenAI;
all percentages on small sites sit on tiny bases; and every number here is unverified snippet-level evidence.

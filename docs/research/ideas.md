# 50 tool ideas ranked by search intent × build simplicity

Goal: pick ideas that people already search for in large numbers, that are cheap to build with AI, and that have a
reason to exist *inside* a chatbot (not just on the web).

## How to read the numbers (please read)

I have **no keyword-volume tool** in this environment (no Ahrefs/Semrush/DataForSEO/Google Keyword Planner).
So volumes come in two flavours:

- **Sourced** — figures that appeared in web search results (marked ✔). These are third-party snapshots, not verified by me.
- **Tier (est.)** — my order-of-magnitude judgement, **not data**. `XL` ≥ 1M/mo, `L` 100K–1M, `M` 10K–100K (global, head term).

**Before spending real build time beyond the first 5, validate the shortlist** with Keyword Planner (free), Semrush's free
checker, or Ahrefs Webmaster Tools. This is a 30-minute task and is the single most valuable next step.

Sourced figures (from web-search result snippets; I could not open the underlying pages, so treat as unverified third-party numbers):
jpg to pdf 4.8M, pdf to word 4.0M, pdf to jpg 3.4M, word to pdf 2.5M, background remover 936K, remove background 247K (monthly).

## Scoring

- **Vol** — volume tier (above).
- **Effort** — AI-assisted build size to a *working* tool: 1 = hours, 2 = a day, 3 = several days, 4–5 = infra/ML heavy.
- **Chat edge** — does the chatbot *need* this tool? **High** = LLMs are unreliable at it (counting, date math, randomness,
  exact arithmetic) or it must produce a real file. **Low** = the model already does it fine, so the app adds little.
- **SEO** — how brutal the head-term competition is for a new domain. Long-tail variants are the realistic play.

## The list

| # | Idea | Vol | Effort | Chat edge | SEO | Notes |
|---|------|-----|--------|-----------|-----|-------|
| 1 | JPG to PDF | XL ✔ 4.8M | 3 | High (file) | Brutal | Needs file upload/transport; phase 2 |
| 2 | PDF to Word | XL ✔ 4.0M | 5 | High (file) | Brutal | Layout fidelity is hard |
| 3 | PDF to JPG | XL ✔ 3.4M | 3 | High (file) | Brutal | |
| 4 | Word to PDF | XL ✔ 2.5M | 4 | High (file) | Brutal | Needs LibreOffice-class engine |
| 5 | Merge PDF | XL | 3 | High (file) | Brutal | pdf-lib makes it feasible |
| 6 | Compress PDF | XL | 4 | High (file) | Brutal | |
| 7 | Image compressor | XL | 3 | High (file) | Brutal | `sharp` |
| 8 | Image resizer | XL | 2 | High (file) | Hard | |
| 9 | HEIC to JPG | L | 3 | High (file) | Hard | |
| 10 | Background remover | L ✔ 936K | 5 | High | Brutal | ML model + GPU/cost |
| 11 | WebP to PNG | L | 2 | High (file) | Medium | |
| 12 | GIF maker / video to GIF | L | 4 | High (file) | Hard | |
| 13 | MP4 to MP3 | L | 4 | High (file) | Hard | ffmpeg |
| 14 | **QR code generator** | XL | **1** | **High** (real image) | Hard | Chatbots can't draw a scannable QR |
| 15 | **Password generator** | L | **1** | **High** (true randomness) | Hard | An LLM must never "invent" a password |
| 16 | Random picker / wheel | L | 2 | High (randomness) | Medium | |
| 17 | Lorem ipsum | L | 1 | Low | Hard | LLM does it fine |
| 18 | UUID generator | M | 1 | High (randomness) | Medium | |
| 19 | Barcode generator | L | 2 | High (real image) | Medium | |
| 20 | Invoice generator | L | 3 | Medium | Hard | Strong commercial intent |
| 21 | Resume builder | XL | 4 | Medium | Brutal | Heavy; saturated |
| 22 | Signature generator | M | 2 | Medium | Medium | |
| 23 | **Word counter** | XL | **1** | **High** (LLMs miscount) | Hard | |
| 24 | Character counter | XL | 1 | High | Hard | Same engine as #23 |
| 25 | Case converter | L | 1 | Medium | Medium | |
| 26 | Text diff | L | 2 | Medium | Medium | |
| 27 | Paraphraser | XL | 3 | Low (it *is* an LLM) | Brutal | |
| 28 | Grammar checker | XL | 3 | Low | Brutal | |
| 29 | Text to speech | XL | 3 | Medium | Brutal | |
| 30 | Plagiarism checker | L | 5 | Medium | Brutal | Needs a corpus |
| 31 | **Age calculator** | XL | **1** | **High** (date math) | Medium | |
| 32 | **Days between dates** | L | **1** | **High** | Medium | Same engine as #31 |
| 33 | **Mortgage / loan calculator** | XL | **2** | **High** (exact math) | Brutal head, OK long-tail | Highest commercial value |
| 34 | Percentage calculator | XL | 1 | High | Hard | |
| 35 | BMI calculator | L | 1 | Medium | Hard | |
| 36 | Tip calculator | L | 1 | Medium | Medium | |
| 37 | Compound interest | L | 1 | High | Medium | |
| 38 | Time zone converter | L | 2 | High (DST rules) | Hard | |
| 39 | Unit converter | XL | 2 | Medium | Brutal | |
| 40 | Currency converter | XL | 2 | High (live rates) | Brutal | Needs an FX data source |
| 41 | Hourly ↔ salary converter | L | 1 | High | Medium | Strong intent |
| 42 | GPA calculator | L | 1 | High | Medium | Seasonal; students |
| 43 | JSON formatter | L | 1 | Medium | Hard | |
| 44 | Base64 encode/decode | L | 1 | Medium | Medium | |
| 45 | Regex tester | L | 2 | Medium | Medium | |
| 46 | Cron expression explainer | M | 1 | Medium | Medium | |
| 47 | Color converter | L | 1 | Medium | Medium | |
| 48 | Unix timestamp converter | L | 1 | High | Medium | |
| 49 | Markdown to HTML | M | 1 | Low | Medium | |
| 50 | **Poko Motion** — text-to-animation / motion graphics | M (est.) | 5 | High | Medium | See verdict below |

## Chosen first five

Selected because they combine **Effort 1–2**, **High chat edge**, and **XL/L demand**, and they share one tiny
dependency-free-ish engine, so one MCP server serves all five:

1. **QR code generator** — XL demand, 1 day, produces a real image the model cannot.
2. **Word & character counter** — XL demand (#23 + #24 share a page), LLMs are demonstrably bad at counting.
3. **Password generator** — L demand, cryptographically secure randomness is something a model must not fake.
4. **Age & date calculator** — XL demand (#31 + #32), date arithmetic is a classic LLM failure.
5. **Mortgage & loan calculator** — XL demand, exact amortisation math, the best commercial intent on the list.

### Why not the PDF / image converters (the biggest numbers)?

They have the largest verified volumes, but: (a) head terms are owned by iLovePDF, Smallpdf, Adobe, Canva, etc.;
(b) they need a file-transport story (upload from chat → server → download link), which is different on each of
ChatGPT/Claude/Grok; (c) several need heavy engines. They are the right **phase 2** once the pipeline is proven — #5, #7, #8 first.

### Poko Motion — verdict

Honest assessment: **don't lead with it.**

- It is the *only* high-effort (5) item that is also not a head-volume keyword; I'd estimate "text animation generator" /
  "animation maker" demand as M, and the intent is diffuse (people may want video, GIFs, lottie, slides or logos).
- The space is crowded by Canva, CapCut, Adobe Express, and many AI-video tools with big budgets.
- It is not "simple to create with AI" the way the first five are, and generative output costs real money per use.
- A *narrow* slice might work later (e.g. "animated text GIF", "lottie from SVG"), but validate demand first.

That is a judgement from the table above, not measured data — if Keyword Planner says otherwise, move it up.

## Update: volume and directory-competition check on the five picks

Run on 2026-10-01 with web search only. **Low-confidence evidence**; absence from a snippet does not prove absence from a directory.

| Pick | Volume figure found (US, monthly) | Already in the ChatGPT directory? |
|------|-----------------------------------|-----------------------------------|
| QR code | "950K+" | **Yes**: AnyQR, QRCM (7 content types, branded/tracked codes), QR Code Maker |
| Word counter | not found | **Yes**: "Word Counter" app (live counts, reading level, top-10 words); also an older ChatGPT plugin, WordCounterGPT |
| Password | "3.1M+" | Not seen |
| Age / dates | "5M+" (age calculator) | Not seen; only generic date/calendar apps (Quick Calendar, Timezone Buddy) |
| Mortgage / loan | "5M+" | Not seen for mortgage; **AutoIQ** covers auto loans/leases |

How far to trust the volumes: they come from a tool-aggregator marketing page, in round "N+" figures, with no methodology. Use them only to
confirm these are big keywords, not to forecast traffic. Directory snapshots also disagree on size (one source says ~330 apps, another ~1,600),
so the directory is growing fast or the sources use different definitions.
Sources: [tool-aggregator listing](https://toolspotai.com/) · [awesome-chatgpt-apps](https://github.com/rdmgator12/awesome-chatgpt-apps) · [QR Code Maker app](https://qr-code-maker.app/qr-code-maker-on-chatgpt) · [WordCounterGPT](https://github.com/ykdojo/WordCounterGPT).

**What this changes:**

- QR and word counter are **already occupied in the ChatGPT directory**. Our QR tool has no tracking/branding/vCard features, so it is the weakest differentiated pick *there*. It is still fine as a web SEO page and as a cheap, working vertical slice.
- Password, age/date and mortgage/loan looked **open** in what I could see. If we only have time to polish and submit three, make it these.
- Cheapest way to differentiate QR/word counter: ship the extra types users expect (Wi-Fi, vCard, email, calendar event for QR; reading level for words) before submitting them to a directory.
- Re-check each directory the day before submitting. Both the volumes and the competition move quickly.

## Caveats on strategy

- A web tool and a chat app are **two different distribution channels**. SEO wins pages; directory listings win chat
  discovery. The shared engine lets us run both for ~the cost of one.
- Directory competition is far thinner than web SEO: the ChatGPT directory has hundreds of apps, mostly business/productivity
  ([State of ChatGPT Apps 2026](https://chatgptappsrank.com/state-of-chatgpt-apps-2026) (from a search snippet)), and few simple utility apps.
  That is the opportunity — but I have no usage numbers showing utility apps get meaningful traffic from the directory.
- Calculators that give financial figures need clear "estimates, not advice" wording — included on the mortgage page.

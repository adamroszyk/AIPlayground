# Getting into ChatGPT, Claude and Grok

One remote MCP server (`toolbox/src/server`) is the single integration point for all three. This page says what is
**verified**, what is **assumed**, and what **only you can do**.

## What exists today

- A stateless Streamable-HTTP MCP server at `/mcp` with 6 tools covering the 5 chosen ideas.
- Every tool has `title`, `readOnlyHint`/`destructiveHint`, a real description, and returns tool errors (`isError`) instead of crashing.
- `create_qr_code` is an **MCP App**: it returns a PNG for hosts without UI, and links a `ui://` widget for hosts with it.
- Registered through `@modelcontextprotocol/ext-apps` helpers, which the Claude docs say emit each host's metadata from one codebase.

Verified by tests in this repo: 13 unit tests, 5 live-server JSON-RPC tests, and a browser test that loads the widget
in a sandboxed iframe through the SDK's reference `AppBridge` host and checks the QR image renders.
**Not verified:** behaviour inside the real ChatGPT, Claude or Grok apps. That needs a public HTTPS URL (below).

## Step 0 (blocks everything): deploy publicly

All three require an `https://` URL. Run `npm start` behind any host that gives HTTPS (Fly.io, Render, Railway, Cloud Run,
a VPS + Caddy). The server is stateless, so it scales horizontally or runs on serverless. Then set
`MCP_URL=https://<host>/mcp SITE_URL=https://<site> CONTACT_EMAIL=<public contact> npm run build:site`
so the website and privacy page carry real values. **The privacy page is a draft: have it reviewed**, and set a public
contact address; I deliberately did not put your personal email on a public page.

## Claude: most concrete path (verified from Anthropic's docs)

Source: [Submit a connector to the directory](https://claude.com/docs/connectors/building/submission).

1. Needs a **paid Claude plan** (Pro/Max/Team/Enterprise) to submit at `claude.ai/directory/manage` → *Submit new* → *MCP connector*.
2. Test first as a *custom connector* (Settings → Connectors) and call each tool; the portal asks you to confirm this.
3. Listing: name (≤100 chars), one-liner (≤200), description (≤2,000), 1–5 categories, docs URL, **privacy policy URL**, support contact, icon.
   A missing/incomplete privacy policy is an immediate rejection per the docs.
4. Auth: our tools use public computation, so choose **no authentication**.
5. Test & launch: reviewer instructions (trivial here: no account needed). Compliance: 7 policy acknowledgements, including AI media generation and prompt-injection items.
6. As an MCP App, add **3–5 PNG screenshots, ≥1000px wide**, cropped to the app response only, with the prompt text supplied separately. No GIF/video.
7. Default outcome is a **Community** listing after automated scan; some get human review. Verified status is separate.

`ui.domain`: Claude uses `<first 32 hex of sha256(server URL)>.claudemcpcontent.com`. It is optional and our widget needs no
stable origin, so I left it unset. Set it only if we later need OAuth callbacks or CORS allowlists.

## ChatGPT (partly verified: secondary sources only; openai.com was blocked from this environment)

- ChatGPT apps are MCP servers using the Apps SDK. Developers can submit apps for review in the OpenAI developer platform, and approved apps appear in an in-product directory ([OpenAI announcement via search result](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/); not opened).
- Reported submission contents: MCP connectivity details, testing guidelines, directory metadata, country availability.
- Higher design/functionality standards may earn featured placement. Treat "get featured" as a *quality bar*, not something we can buy or ensure.
- The Claude docs state MCP Apps built with the ext-apps SDK run in other MCP Apps hosts and describe a migration path from the OpenAI Apps SDK, which is why I used it. **Open question:** whether ChatGPT needs ChatGPT-specific metadata (e.g. its own `ui.domain` form like `*.oaiusercontent.com`) beyond what the helper emits. Test in ChatGPT developer mode and read OpenAI's current guidelines before submitting.
- ChatGPT requires accounts/verification for submitters that I could not confirm: check the developer dashboard.

## Grok (partly verified: two secondary sources; x.ai blocked here)

- xAI launched a **Grok Build plugin marketplace** (June 2026), a catalog in the GitHub repo `xai-org/plugin-marketplace`.
  A plugin can bundle skills, commands, agents, hooks and MCP servers. Remote plugins **pin a full 40-char commit SHA**, re-verified after clone.
- Evidence from one accepted-style integration PR: the indexer reads `.grok-plugin/plugin.json` and `.mcp.json` (leading dot required) and points at the hosted MCP URL.
  I did **not** create these manifests: I never saw the schema, and an invented manifest would just fail validation.
  Copy the structure from an accepted precedent in that repo (the PR cited `OpenPhone/quo-grok-plugin`), run the marketplace's validator, then open a catalog PR pinned to a commit SHA.
- **"Grok Bot"** (the thing you named) is described as a separate marketplace for third-party "AI teammates", reportedly *testing / coming soon*. I found no public submission path. Grok Build plugins is the only route I can confirm today.
- Grok Build is a coding-agent product, so general utilities (age, loan) may fit its audience less than the other two. Worth checking the audience before investing.

## Recommended order

1. Deploy + real privacy contact (blocker).
2. Claude connector (clear docs, fastest feedback loop; Community listing needs no manual approval).
3. ChatGPT developer-mode test, then submit.
4. Grok plugin PR once we've copied a valid manifest.
5. In parallel: validate keyword volumes (see `docs/research/ideas.md`), then submit sitemap to Search Console.

## Risks worth knowing

- **Thin differentiation.** These tools are simple; the directories reward quality and usage, not novelty. Expect to compete mostly on exactness and speed.
- **Directory traffic is unproven.** I found no usage data for utility apps. Don't assume listings drive volume until we see analytics.
- **Passwords in chat.** The connector's password tool returns the password into the conversation. The site says so and points to the web tool for important passwords; reviewers may still flag it. Consider dropping that tool from the directory build if it draws pushback.
- **Financial output.** The loan tool carries "estimate, not advice" text; keep it, and read each directory's financial-content policy (Claude's compliance step lists "financial transactions").

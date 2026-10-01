# Go-live checklist and runbook

Everything below the line "Only you can do" needs your accounts or your decisions. Everything above it is built and tested.

## Built and verified in the sandbox

| Area | State | Evidence |
|---|---|---|
| Landing, privacy, terms, support, waitlist, challenge route | Done | `tests/landing.e2e.mjs` (44 checks) |
| MCP servers (3 stable tools each), D1 storage, widgets | Done | `home.e2e`, `wedding.e2e`, `widgets.e2e` |
| Web editors with live rule checking, save, share, delete | Done | `home-editor.e2e` (20), `wedding-editor.e2e` (31) |
| Plugin packages (ZIP + linter for OpenAI's submission rules) | Done | `npm run package:plugins`, `plugin-kit` unit tests (12) |
| Review test cases (5 positive, 3 negative per plugin) | Positive cases executed against the real servers; negative cases checked statically | `tests/review-cases.test.mjs` |
| Tool-schema freeze (OpenAI holds metadata changes) | Snapshot + compatibility check | `apps/*/plugin/tools.snapshot.json` |
| Deploy script, post-deploy smoke test, CI | Written; deploy dry-run accepted by wrangler; smoke test passes locally and fails loudly when it should | `scripts/deploy.mjs`, `scripts/smoke.mjs`, `tests/smoke.local.test.mjs` |

One command runs all of it: `cd planner && npm run test:all`.

### Not verified (be aware)

- **The widget inside ChatGPT.** It is tested in a sandboxed host with the MCP Apps SDK, not in ChatGPT. OpenAI's UI guidelines, Plugin UI reference, plugin guidelines and MCP review requirements pages were not available to me. Paste them and I will check the widget and tool descriptions against them.
- **Cloudflare deploy.** The sandbox cannot reach Cloudflare, so `wrangler deploy` itself has never run. Config is accepted by `wrangler deploy --dry-run`. D1 and KV are created automatically on first deploy (documented by Cloudflare); confirm in the dashboard that exactly one D1 database and one KV namespace exist per Worker afterwards.
- **Worker startup time** must be under 1 second (Cloudflare limit). The bundle is about 2 MB. The deploy output prints `startup_time_ms`; check it.
- **Demand.** No search-volume evidence for either product (see `docs/research`). Run the free checks in parallel.
- **Name collisions** for "Roomwise" and "Aisle" are unchecked. Names live in `apps/*/site/content.ts` and `apps/*/plugin/spec.ts`.
- **Category.** Both specs use "Lifestyle". The dashboard's category list is what counts; change it in `spec.ts` if needed.

---

## Only you can do (in this order)

### 1. Publisher identity
Verify as an individual or business in the OpenAI dashboard. The name you choose goes in `PUBLISHER_NAME` and must be identical on the landing pages, `author.name` and `developerName` (the linter enforces the last two).

### 2. Domain and hostnames
**Free option:** `https://roomwise.<your-workers-subdomain>.workers.dev` and `https://aisle.<your-workers-subdomain>.workers.dev` (the Worker names are `roomwise` and `aisle`). `scripts/deploy.mjs` and `scripts/package-plugins.ts` look your subdomain up themselves from `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (set `ROOMWISE_URL` / `AISLE_URL` to override), so you do not need to know it; no route is needed. Trade-offs: Cloudflare treats workers.dev as hobby-grade, and **renaming your workers.dev subdomain later changes the MCP URL and breaks the plugin**. Testing in ChatGPT developer mode (step 7) needs only a working HTTPS URL, not an upload, so a workers.dev URL is a good place to start.

**Own domain:** add a domain to Cloudflare (an active zone). Choose two hostnames, for example `roomwise.<domain>` and `aisle.<domain>`. **The MCP URL (`https://<host>/mcp`) cannot be changed after the first upload without OpenAI support.** The domain-verification token is per hostname.

### 3. Cloudflare account
- **Workers Paid plan.** The free plan allows 10 ms CPU per request; the seating and layout solvers need more (paid default is 30 s; the deploy config caps it at 10 s).
- An API token. Start from the "Edit Cloudflare Workers" template; if the first deploy reports a D1 permission error, add Account → D1 → Edit. Note your account id.
- The hostname must not already have a CNAME record (Cloudflare restriction for custom domains).

### 3b. Spending protection (do this before the first deploy)
Cloudflare cannot hard-cap spending. The Workers enforce daily caps themselves (50 solver calls and 10,000 dynamic requests per product per day, 5 s CPU per call) so both products fit inside the $5 plan's included usage, and you add email warnings in the dashboard: **Manage Account > Billing > Billable Usage > Set Budget Alert**, at **$0.50** and **$2.00**, email to **szyk.adam@gmail.com**. Full explanation and the honest limits: `docs/plan/cost-controls.md`.

### 4. Public contact email
Used on the privacy, terms and support pages and in `author.email`. Do not use a personal inbox you are not willing to publish.

### 5. First deploy
Your credentials can be saved once with `npm run credentials` (token in the macOS Keychain or Linux keyring, else a private file outside the repo; check with `-- --show`, remove with `-- --forget`). `npm run deploy` then uses them and offers to save them if you type them in.

One command (bash, zsh or WSL). It asks for the API token (hidden), the account ID, your publisher name and a contact email, rejects placeholders and malformed values, deploys both products, smoke-tests them, and builds the plugin ZIPs:

```sh
git clone -b claude/beautiful-ride-28tutl https://github.com/adamroszyk/aiplayground.git aiplayground-deploy
cd aiplayground-deploy/planner
npm ci
npm run deploy          # add -- --dry-run first if you want a rehearsal that uploads nothing
```

Or use the manual GitHub workflow `planner` (repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional `OPENAI_APPS_CHALLENGE_*`; repository variables `PUBLISHER_NAME`, `CONTACT_EMAIL`; a `production` environment). Per product: `node scripts/deploy.mjs home|wedding`.

### 6. Domain verification
In the OpenAI Plugins page, start verification for the plugin's hostname; it shows a token. Then, from `planner/`:

```sh
npm run set-challenge -- home      # or: wedding
```
It asks for the token (hidden), stores it as the Worker secret `OPENAI_APPS_CHALLENGE`, and checks that `/.well-known/openai-apps-challenge` returns exactly that token. Then click Verify on the OpenAI page.

### 7. Test in ChatGPT developer mode before submitting
Add each MCP URL (`https://roomwise.<subdomain>.workers.dev/mcp`, `https://aisle.<subdomain>.workers.dev/mcp`) as a connector in developer mode, with no authentication, and run the prompts. `npm run prompts` prints them with the tool each should call and what to look for. Watch for: the widget rendering, the edit link opening the editor, the model choosing the expected tool, the negative prompts being declined. Each product allows 50 solver calls a day, and the deploy smoke test already used 2 to 3 of them. Tell me what you see and I will fix it.

### 8. Demo video
`npm run demo:video` records a captioned walkthrough of each product (real MCP call, real widget in an MCP Apps host, real web editor) into `planner/dist/demo/`. It is not footage from inside ChatGPT. Record the ChatGPT part yourself using `docs/plan/demo-script.md` and add it, since reviewers need to see the plugin used in ChatGPT. Host the result where reviewers can open it without signing in. Set `DEMO_URL_ROOMWISE` and `DEMO_URL_AISLE`.

### 8b. If the dashboard rejects a field (for example the category)
The dashboard's own lists decide. Rebuild with the exact wording shown there, then upload the new ZIP (package metadata changes need a new ZIP; the MCP URL stays the same):
```sh
PLUGIN_CATEGORY_ROOMWISE="<exact category>" PLUGIN_CATEGORY_AISLE="<exact category>" npm run package:plugins
```
`package:plugins` refuses to build if it cannot tell where the plugin is deployed or if the publisher name or email is missing, so a placeholder ZIP cannot be produced by accident.

### 9. Build the release ZIPs
```sh
export DEMO_URL_ROOMWISE=... DEMO_URL_AISLE=...
npm run package:plugins:release     # fails on any placeholder or missing demo URL
```
Upload `roomwise-1.0.0.zip` and `aisle-seating-1.0.0.zip` in the Plugins dashboard. A real build is also copied to your Downloads folder (set `PLUGIN_ZIP_DIR` to choose another, or `--no-copy` to skip); builds with placeholder values are never copied. Reviewer credentials are not needed (no sign-in).

### 10. Legal review
Have privacy and terms reviewed (they are templates written from the actual data flows: see `data` in each `site/content.ts`). Guest names are personal data about third parties.

### 11. After approval
OpenAI scans the MCP server daily and holds tool-metadata changes. Before any deploy that touches tools run `npm run test:review`; it fails on a breaking change and lists changes that would be held. Re-record the snapshot only for an intentional change (`npm run snapshot:tools`).

---

## Environment reference

| Variable | Where | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | deploy | wrangler credentials |
| `ROOMWISE_URL`, `AISLE_URL` | deploy, packaging | `https://<hostname>`; sets canonical URLs, `PUBLIC_BASE_URL` (used in saved-plan links) and the MCP URL |
| `PUBLISHER_NAME`, `CONTACT_EMAIL` | build, packaging | legal pages, manifest author |
| `OPENAI_APPS_CHALLENGE_ROOMWISE`, `_AISLE` | deploy | stored as the Worker secret `OPENAI_APPS_CHALLENGE` |
| `DEMO_URL_ROOMWISE`, `_AISLE` | packaging | `review.demo_recording_url` |
| `DAILY_REQUEST_LIMIT`, `DAILY_SOLVE_LIMIT` | deploy (optional) | daily circuit breaker; defaults 10000 and 50; the deploy script refuses values that could exceed the included allowance |

## Runbook

- **Logs:** `npx wrangler tail --config wrangler.deploy.json` in `planner/apps/<app>`, or the dashboard (observability is enabled).
- **Roll back:** `npx wrangler rollback --config wrangler.deploy.json`. Tool-schema changes are the risky ones; see step 11.
- **Delete someone's plan on request:** `npx wrangler d1 execute DB --remote --config wrangler.deploy.json --command "DELETE FROM plans WHERE id = '<id>'"`. Waitlist entries live in KV under `waitlist:<product>:<sha256 of email>`.
- **Retention:** plans expire 90 days after the last edit; a daily cron (03:17 UTC) deletes expired rows. Check the cron ran in the dashboard after the first day.
- **Daily caps:** see `docs/plan/cost-controls.md`. "Daily capacity" or "daily limit" messages mean a cap was reached; it resets at 00:00 UTC. Usage: `npx wrangler d1 execute DB --remote --config wrangler.deploy.json --command "SELECT * FROM usage ORDER BY day DESC LIMIT 14"`.
- **Smoke test any time:** `node scripts/smoke.mjs https://<host> home|wedding`.
- **If the MCP endpoint returns Error 1102:** a solve exceeded the CPU limit. Check the plan is Workers Paid and `limits.cpu_ms` (5000) in the deployed config; look for unusually large inputs (limits are 300 guests, 25 pieces).
- **If a user reports a wrong layout or seating:** the independent verifier output shown in the tool result names each failing rule; reproduce with the same input in `check_*`.

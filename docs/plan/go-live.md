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
Add a domain to Cloudflare (an active zone). Choose two hostnames, for example `roomwise.<domain>` and `aisle.<domain>`. **The MCP URL (`https://<host>/mcp`) cannot be changed after the first upload without OpenAI support.** The domain-verification token is per hostname.

### 3. Cloudflare account
- **Workers Paid plan.** The free plan allows 10 ms CPU per request; the seating and layout solvers need more (paid default is 30 s; the deploy config caps it at 10 s).
- An API token. Start from the "Edit Cloudflare Workers" template; if the first deploy reports a D1 permission error, add Account → D1 → Edit. Note your account id.
- The hostname must not already have a CNAME record (Cloudflare restriction for custom domains).

### 4. Public contact email
Used on the privacy, terms and support pages and in `author.email`. Do not use a personal inbox you are not willing to publish.

### 5. First deploy
Either run locally or use the manual GitHub workflow `planner` (repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional `OPENAI_APPS_CHALLENGE_*`; repository variables `PUBLISHER_NAME`, `CONTACT_EMAIL`, `ROOMWISE_URL`, `AISLE_URL`; an `production` environment).

```sh
cd planner
npm ci
export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
export PUBLISHER_NAME="..." CONTACT_EMAIL="..." ROOMWISE_URL=https://roomwise.<domain> AISLE_URL=https://aisle.<domain>
node scripts/deploy.mjs home          # builds, deploys, applies D1 migrations, smoke-tests
node scripts/deploy.mjs wedding
```

### 6. Domain verification
In the OpenAI dashboard start verification for each hostname; it shows a token. Then:

```sh
export OPENAI_APPS_CHALLENGE_ROOMWISE=<token> OPENAI_APPS_CHALLENGE_AISLE=<token>
node scripts/deploy.mjs home && node scripts/deploy.mjs wedding   # sets the secret; smoke test checks the route returns exactly the token
```

### 7. Test in ChatGPT developer mode before submitting
Add each MCP URL as a connector in developer mode and run all 8 prompts per plugin from `apps/*/plugin/spec.ts`. Watch for: the widget rendering, the edit link opening the editor, the model choosing the expected tool, the negative prompts being declined. Tell me what you see and I will fix it.

### 8. Demo video
Record each plugin using `docs/plan/demo-script.md`; host it where reviewers can open it without signing in. Set `DEMO_URL_ROOMWISE` and `DEMO_URL_AISLE`.

### 9. Build the release ZIPs
```sh
export DEMO_URL_ROOMWISE=... DEMO_URL_AISLE=...
npm run package:plugins:release     # fails on any placeholder or missing demo URL
```
Upload `planner/dist/plugins/roomwise-1.0.0.zip` and `aisle-seating-1.0.0.zip` in the Plugins dashboard. Reviewer credentials are not needed (no sign-in).

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

## Runbook

- **Logs:** `npx wrangler tail --config wrangler.deploy.json` in `planner/apps/<app>`, or the dashboard (observability is enabled).
- **Roll back:** `npx wrangler rollback --config wrangler.deploy.json`. Tool-schema changes are the risky ones; see step 11.
- **Delete someone's plan on request:** `npx wrangler d1 execute DB --remote --config wrangler.deploy.json --command "DELETE FROM plans WHERE id = '<id>'"`. Waitlist entries live in KV under `waitlist:<product>:<sha256 of email>`.
- **Retention:** plans expire 90 days after the last edit; a daily cron (03:17 UTC) deletes expired rows. Check the cron ran in the dashboard after the first day.
- **Smoke test any time:** `node scripts/smoke.mjs https://<host> home|wedding`.
- **If the MCP endpoint returns Error 1102:** a solve exceeded the CPU limit. Check the plan is Workers Paid and `limits.cpu_ms` in the deployed config; look for unusually large inputs (limits are 300 guests, 25 pieces).
- **If a user reports a wrong layout or seating:** the independent verifier output shown in the tool result names each failing rule; reproduce with the same input in `check_*`.

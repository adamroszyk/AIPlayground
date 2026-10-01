# Cost controls: staying inside the $5 plan

Goal: the monthly bill stays at the $5 Workers Paid subscription, with no usage charges on top.

**Cloudflare has no hard spending cap.** Budget alerts only send email, are calculated daily, fire the day after a threshold is crossed, and "do not cap your usage" (Cloudflare changelog, 2026-06-15). So there are two layers: limits inside the Workers that make overage practically impossible, and Cloudflare alerts that warn you if anything is still off.

## Layer 1: limits in the Workers (hard, tested)

| Control | Default | Where |
|---|---|---|
| Solver calls (`plan_room_layout`, `plan_wedding_seating`) | **50 per day per product** | `UsageGuard`, checked inside the tool |
| Dynamic requests (`/mcp`, `/api/*`, `/p/*`) | **10,000 per day per product** | `gateRequest`, checked before any work |
| CPU per invocation | **5 s** | `limits.cpu_ms` in the generated deploy config |

Static pages (landing, legal, the editor files) never reach the Worker and are free and unlimited on Cloudflare.

Counters live in the product's D1 `usage` table and reset at 00:00 UTC. Once a cap is reached:
- `/mcp` and `/api/*` answer HTTP 429 with `Retry-After`; the ChatGPT tool says "reached its daily limit of N layout or seating plans. It resets at 00:00 UTC", and the check, estimate and timeline tools keep working until the request cap.
- The web editors keep working (the solver runs in the visitor's browser) except saving.
- The domain-verification route and CORS preflights are never counted or blocked.
- After the cap, a request writes nothing to D1, so a flood does not add D1 write charges.
- If the counter itself fails the request is refused with 503 (fail closed).

### Why these numbers
Worst case per product per day: 10,000 requests x 20 ms + 50 solves x 5,000 ms = 450,000 CPU ms. Two products x 31 days = **27.9M CPU ms, under the 30M included**. Requests: at most 0.62M a month against 10M included. D1 writes: about 0.6M a month against 50M included. Typical real usage is far below: measured warm CPU is about 30 ms per solve and 5 to 10 ms per other call. `usage.test.ts` fails if anyone changes the defaults so that the worst case no longer fits, and `scripts/deploy.mjs` refuses to deploy limits that do not fit.

### Honest limits of this layer
- The 20 ms and 5 s figures are assumptions (the 5 s is enforced by Cloudflare; the 20 ms is from my Node measurements, not Cloudflare's meter). The meter is the truth, which is why layer 2 exists.
- A flood of requests is still *invoked* before it is refused. Each costs about 1 ms of CPU; beyond 10M requests a month Cloudflare charges $0.30 per extra million. That is a denial-of-service scenario, and the alerts below are your warning for it.
- The limits are small on purpose. If the plugin is approved and genuinely busy, users will hit "daily limit" messages. Raise them deliberately with `DAILY_SOLVE_LIMIT` / `DAILY_REQUEST_LIMIT` (the deploy script recomputes the worst case and refuses unsafe values), and expect to pay for the extra CPU.

## Layer 2: Cloudflare budget alerts (you set these, 2 minutes)

Alerts are on usage-based spend only; the $5 subscription fee is excluded from the threshold. So a $0.50 alert means "I am about to be billed beyond the $5".

1. Dashboard, **Manage Account > Billing > Billable Usage > Set Budget Alert** (or **Notifications > Add > Budget Alert**).
2. Create two alerts: **$0.50** and **$2.00**.
3. In the notification, set the email recipient to **szyk.adam@gmail.com** (the default is the account's own address). Cloudflare may already have created a default $10 alert; lower or replace it.
4. Check **Billable Usage** weekly for the first month; it matches the invoice.

Why I cannot send these emails from the Workers themselves: sending mail from a Worker needs Cloudflare Email Routing on a domain you own, and the free `workers.dev` hostname has none. If you add a domain later, a "80% of today's cap" email can be added.

## Checking usage
```sh
cd planner/apps/home    # or wedding
npx wrangler d1 execute DB --remote --config wrangler.deploy.json --command "SELECT * FROM usage ORDER BY day DESC LIMIT 14"
```
The smoke test (`scripts/smoke.mjs`) uses 2 to 3 solves of the day's 50 per run.

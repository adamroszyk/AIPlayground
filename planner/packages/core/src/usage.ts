import type { D1Like } from "./plans.ts";

/**
 * Daily circuit breaker. Cloudflare has no hard spending cap (budget alerts only warn), so the Workers stop serving
 * dynamic requests and solver calls once a daily allowance is used up. The defaults are sized so that both products
 * together stay inside the Workers Paid plan's included allowance (see docs/plan/cost-controls.md and usage.test.ts).
 */
export interface UsageLimits { requestsPerDay: number; solvesPerDay: number }
export const DEFAULT_LIMITS: UsageLimits = { requestsPerDay: 10_000, solvesPerDay: 50 };

/** Assumptions behind the defaults. The unit test fails if the defaults no longer fit the included CPU allowance. */
export const COST_MODEL = { includedCpuMsPerMonth: 30_000_000, includedRequestsPerMonth: 10_000_000, products: 2, daysPerMonth: 31, worstCpuMsPerRequest: 20, cpuMsLimitPerInvocation: 5_000 };

export const USAGE_MIGRATION = `CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
`;

export type UsageKind = "req" | "solve";
export type Take = { ok: true; used: number } | { ok: false; limit: number; retryAfterSeconds: number };

const positive = (v: string | undefined, fallback: number) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : fallback; };
export const limitsFromEnv = (env: { DAILY_REQUEST_LIMIT?: string; DAILY_SOLVE_LIMIT?: string }): UsageLimits => ({
  requestsPerDay: positive(env.DAILY_REQUEST_LIMIT, DEFAULT_LIMITS.requestsPerDay),
  solvesPerDay: positive(env.DAILY_SOLVE_LIMIT, DEFAULT_LIMITS.solvesPerDay),
});

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const secondsToMidnightUtc = (ms: number) => Math.max(1, Math.ceil((Date.UTC(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth(), new Date(ms).getUTCDate() + 1) - ms) / 1000));

export class UsageGuard {
  private db: D1Like;
  private limits: UsageLimits;
  private clock: () => number;
  constructor(db: D1Like, limits: UsageLimits = DEFAULT_LIMITS, clock: () => number = () => Date.now()) {
    this.db = db;
    this.limits = limits;
    this.clock = clock;
  }

  /**
   * Takes one unit from today's allowance. One conditional UPDATE in the normal case; once the limit is reached it
   * writes nothing at all, so a flood after the cap does not run up D1 write charges.
   */
  async take(kind: UsageKind): Promise<Take> {
    const limit = kind === "req" ? this.limits.requestsPerDay : this.limits.solvesPerDay;
    const now = this.clock(), day = dayOf(now);
    const bump = () => this.db.prepare("UPDATE usage SET n = n + 1 WHERE day = ? AND kind = ? AND n < ? RETURNING n").bind(day, kind, limit).first<{ n: number }>();
    let row = await bump();
    if (!row) {
      await this.db.prepare("INSERT OR IGNORE INTO usage (day, kind, n) VALUES (?, ?, 0)").bind(day, kind).run();
      row = await bump();
    }
    return row ? { ok: true, used: row.n } : { ok: false, limit, retryAfterSeconds: secondsToMidnightUtc(now) };
  }

  async purgeOld(keepDays = 40): Promise<void> {
    await this.db.prepare("DELETE FROM usage WHERE day < ?").bind(dayOf(this.clock() - keepDays * 86_400_000)).run();
  }
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/**
 * Gate for every dynamic request. Returns a response to send instead of handling the request, or null to continue.
 * The domain-verification route and CORS preflights are never counted. If the counter itself fails the request is refused
 * (fail closed), because an unmetered Worker is exactly what this guard exists to prevent.
 */
export async function gateRequest(guard: UsageGuard, req: Request, pathname: string): Promise<Response | null> {
  if (pathname.startsWith("/.well-known/") || req.method === "OPTIONS") return null;
  try {
    const t = await guard.take("req");
    if (t.ok) return null;
    return json({ error: "This service has reached its daily capacity. Please try again after 00:00 UTC.", retryAfterSeconds: t.retryAfterSeconds }, 429, { "retry-after": String(t.retryAfterSeconds), "access-control-allow-origin": "*" });
  } catch {
    return json({ error: "Temporarily unavailable. Please try again in a few minutes." }, 503, { "retry-after": "60", "access-control-allow-origin": "*" });
  }
}

/** For the solver tools: throws a user-readable RangeError (reported to the model as a tool error) when today's solver allowance is used up. */
export async function takeSolve(guard: UsageGuard): Promise<void> {
  const t = await guard.take("solve");
  if (!t.ok) throw new RangeError(`This plugin has reached its daily limit of ${t.limit} layout or seating plans. It resets at 00:00 UTC. The check, estimate and timeline tools and the web editor still work.`);
}

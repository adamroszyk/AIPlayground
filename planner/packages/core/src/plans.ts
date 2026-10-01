/** Minimal D1 surface, so this package needs no Cloudflare types. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
    };
  };
}

export const PLAN_TTL_DAYS = 90;
export const MAX_PLAN_BYTES = 200_000;
const DAY = 86_400;

export const PLANS_MIGRATION = `CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  manage_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_expires ON plans (expires_at);
`;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomId = (bytes = 16) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface StoredPlan {
  id: string;
  kind: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

/**
 * Plans live behind an unguessable id (view) and a separate manage token (edit and delete).
 * Only a hash of the token is stored. Plans expire PLAN_TTL_DAYS after their last edit.
 */
export class PlanStore {
  private db: D1Like;
  private now: () => number;
  constructor(db: D1Like, now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.db = db;
    this.now = now;
  }

  async create(kind: string, data: unknown): Promise<{ id: string; manageToken: string }> {
    const json = JSON.stringify(data);
    if (json.length > MAX_PLAN_BYTES) throw new RangeError("plan is too large to save");
    const id = randomId(16), manageToken = randomId(24), t = this.now();
    await this.db
      .prepare("INSERT INTO plans (id, kind, data, manage_hash, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, kind, json, await sha256Hex(manageToken), t, t, t + PLAN_TTL_DAYS * DAY)
      .run();
    return { id, manageToken };
  }

  async get(id: string): Promise<StoredPlan | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;
    const row = await this.db.prepare("SELECT id, kind, data, created_at, updated_at, expires_at FROM plans WHERE id = ? AND expires_at > ?").bind(id, this.now()).first<{ id: string; kind: string; data: string; created_at: number; updated_at: number; expires_at: number }>();
    return row ? { id: row.id, kind: row.kind, data: JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at } : null;
  }

  private async authorised(id: string, token: string): Promise<boolean> {
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return false;
    const row = await this.db.prepare("SELECT manage_hash FROM plans WHERE id = ? AND expires_at > ?").bind(id, this.now()).first<{ manage_hash: string }>();
    return !!row && safeEqual(row.manage_hash, await sha256Hex(token));
  }

  async update(id: string, token: string, data: unknown): Promise<boolean> {
    if (!(await this.authorised(id, token))) return false;
    const json = JSON.stringify(data);
    if (json.length > MAX_PLAN_BYTES) throw new RangeError("plan is too large to save");
    const t = this.now();
    await this.db.prepare("UPDATE plans SET data = ?, updated_at = ?, expires_at = ? WHERE id = ?").bind(json, t, t + PLAN_TTL_DAYS * DAY, id).run();
    return true;
  }

  async remove(id: string, token: string): Promise<boolean> {
    if (!(await this.authorised(id, token))) return false;
    await this.db.prepare("DELETE FROM plans WHERE id = ?").bind(id).run();
    return true;
  }

  async purgeExpired(): Promise<void> {
    await this.db.prepare("DELETE FROM plans WHERE expires_at <= ?").bind(this.now()).run();
  }
}

// ---------------------------------------------------------------------------------------------
// HTTP API: /api/plans[/:id]. The manage token travels in the x-manage-token header, never in the URL.
// ---------------------------------------------------------------------------------------------
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export interface PlansApiOptions {
  /** Throws a RangeError with a user-readable message if the data is not a valid plan of this kind. */
  validate(kind: string, data: unknown): void;
  kinds: string[];
}

export async function handlePlansApi(req: Request, store: PlanStore, opts: PlansApiOptions): Promise<Response> {
  const url = new URL(req.url);
  const rest = url.pathname.replace(/^\/api\/plans\/?/, "");
  const id = rest.split("/")[0] ?? "";
  const readBody = async () => {
    const text = await req.text();
    if (text.length > MAX_PLAN_BYTES + 1000) throw new RangeError("Request too large");
    return JSON.parse(text) as Record<string, unknown>;
  };
  try {
    if (!id) {
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const body = await readBody();
      const kind = String(body.kind ?? "");
      if (!opts.kinds.includes(kind)) return json({ error: "Unknown plan kind" }, 400);
      opts.validate(kind, body.data);
      const { id: newId, manageToken } = await store.create(kind, body.data);
      return json({ id: newId, manageToken }, 201);
    }
    if (req.method === "GET") {
      const plan = await store.get(id);
      return plan ? json(plan) : json({ error: "Plan not found or expired" }, 404);
    }
    const token = req.headers.get("x-manage-token") ?? "";
    if (req.method === "PUT") {
      const body = await readBody();
      const existing = await store.get(id);
      if (!existing) return json({ error: "Plan not found or expired" }, 404);
      opts.validate(existing.kind, body.data);
      return (await store.update(id, token, body.data)) ? json({ ok: true }) : json({ error: "Not allowed" }, 403);
    }
    if (req.method === "DELETE") return (await store.remove(id, token)) ? json({ ok: true }) : json({ error: "Not allowed" }, 403);
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
    if (e instanceof RangeError) return json({ error: e.message }, 400);
    console.error("plans api failure", e);
    return json({ error: "Internal error" }, 500);
  }
}

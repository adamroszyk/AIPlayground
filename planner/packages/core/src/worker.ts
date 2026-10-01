/** Minimal KV surface used here, so the package needs no Cloudflare types dependency. */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST /api/waitlist {email, company?}. `company` is a honeypot: bots fill it, humans never see it. */
export async function handleWaitlist(req: Request, kv: KV, product: string): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return json({ error: "Expected JSON" }, 415);
  const raw = await req.text();
  if (raw.length > 2048) return json({ error: "Request too large" }, 413);
  let body: { email?: unknown; company?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof body.company === "string" && body.company.length > 0) return json({ ok: true }); // honeypot: pretend success
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return json({ error: "Please enter a valid email address." }, 400);
  const key = `waitlist:${product}:${await sha256Hex(email)}`;
  if (!(await kv.get(key))) await kv.put(key, JSON.stringify({ email, product, createdAt: new Date().toISOString() }));
  return json({ ok: true });
}

/**
 * GET /.well-known/openai-apps-challenge: plain-text token, exactly as OpenAI's portal shows it
 * (not JSON, no trailing newline). 404 until the secret is configured.
 */
export function handleChallenge(token: string | undefined): Response {
  if (!token) return new Response("Not found", { status: 404 });
  return new Response(token.trim(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

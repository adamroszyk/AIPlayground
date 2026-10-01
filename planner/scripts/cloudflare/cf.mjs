// Finds this account's workers.dev hostname, so nobody has to look it up or type it.
const API = "https://api.cloudflare.com/client/v4";

/** The account's workers.dev subdomain, or null if the account has not registered one. Throws with a readable reason on API errors. */
export async function workersSubdomain({ token, account, fetchImpl = fetch }) {
  const res = await fetchImpl(`${API}/accounts/${account}/workers/subdomain`, { headers: { authorization: `Bearer ${token}` } });
  let body;
  try { body = await res.json(); } catch { throw new Error(`Cloudflare answered HTTP ${res.status} with a non-JSON body`); }
  if (!body.success) throw new Error(`Cloudflare refused the subdomain lookup (HTTP ${res.status}): ${(body.errors ?? []).map((e) => e.message).join("; ") || "unknown error"}. Check that CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are right, or set the URL variable yourself.`);
  return body.result?.subdomain ?? null;
}

/**
 * https origin for one product: the explicit variable wins; otherwise https://<worker>.<subdomain>.workers.dev from the account.
 * Returns null when neither is available (no variable, no credentials).
 */
export async function resolveSiteUrl({ envName, workerName, env = process.env, fetchImpl = fetch }) {
  const explicit = (env[envName] ?? "").replace(/\/$/, "");
  if (explicit) return explicit;
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  const sub = await workersSubdomain({ token: env.CLOUDFLARE_API_TOKEN, account: env.CLOUDFLARE_ACCOUNT_ID, fetchImpl });
  if (!sub) throw new Error("This account has no workers.dev subdomain yet. In the dashboard open Workers & Pages and choose one (it becomes part of the permanent MCP URL), then rerun.");
  return `https://${workerName}.${sub}.workers.dev`;
}

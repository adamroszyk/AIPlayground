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

/**
 * Checks, before anything is uploaded, that the token can reach the three services a deploy touches.
 * Returns the names of the permissions that are missing (empty = fine). A network failure is reported separately, never as "missing".
 */
export async function missingPermissions({ token, account, fetchImpl = fetch }) {
  const probes = [
    ["Workers Scripts: Edit", `/accounts/${account}/workers/scripts`],
    ["Workers KV Storage: Edit", `/accounts/${account}/storage/kv/namespaces?per_page=1`],
    ["D1: Edit", `/accounts/${account}/d1/database?per_page=1`],
  ];
  const missing = [], unreachable = [];
  for (const [name, path] of probes) {
    try {
      const res = await fetchImpl(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      const denied = res.status === 401 || res.status === 403 || (body.errors ?? []).some((e) => [10000, 9109, 10001].includes(e.code));
      if (denied) missing.push(name); else if (!res.status || res.status >= 500) unreachable.push(name);
    } catch { unreachable.push(name); }
  }
  return { missing, unreachable };
}

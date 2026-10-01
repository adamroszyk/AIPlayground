import { spawn, spawnSync } from "node:child_process";

export function startWorker(dir, port, inspector, extra = [], opts = {}) {
  // Test workers get a huge daily allowance unless a test sets its own, so the circuit breaker never trips by accident.
  const vars = [];
  for (const k of ["DAILY_REQUEST_LIMIT", "DAILY_SOLVE_LIMIT"]) if (!extra.some((a) => a.startsWith(`${k}:`))) vars.push("--var", `${k}:100000000`);
  const persist = opts.persist ? ["--persist-to", opts.persist] : [];
  // Apply D1 migrations to the local database first (idempotent).
  spawnSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", ...persist], { cwd: dir, input: "y\n", stdio: ["pipe", "ignore", "ignore"] });
  const p = spawn("npx", ["wrangler", "dev", "--local", "--port", String(port), "--inspector-port", String(inspector), ...persist, ...vars, ...extra], { cwd: dir, stdio: "ignore", detached: true });
  const stop = () => { try { process.kill(-p.pid, "SIGKILL"); } catch {} };
  process.on("exit", stop);
  return { base: `http://127.0.0.1:${port}`, stop, ready: async () => {
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
    throw new Error(`wrangler dev did not start in ${dir}`);
  } };
}

let id = 0;
export function mcpClient(base) {
  const rpc = async (method, params = {}) => {
    const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    const raw = await res.text();
    const body = raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data:"))?.slice(5);
    if (!body) throw new Error(`${method}: HTTP ${res.status} ${raw.slice(0, 200)}`);
    return JSON.parse(body);
  };
  return { rpc, call: async (name, args) => (await rpc("tools/call", { name, arguments: args })).result };
}

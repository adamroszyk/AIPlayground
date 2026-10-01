import { createMcpHandler } from "@modelcontextprotocol/server";
import { PlanStore, handleChallenge, handlePlansApi, handleWaitlist, type D1Like, type KV } from "@planner/core";
import { createServer } from "./tools.ts";
import { validateRoomPlan } from "./model.ts";

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  WAITLIST: KV;
  DB: D1Like;
  /** Set with `wrangler secret put OPENAI_APPS_CHALLENGE` once the OpenAI portal shows the token. */
  OPENAI_APPS_CHALLENGE?: string;
  /** Optional: public origin used in plan links, e.g. https://roomwise.example.com. Defaults to the request origin. */
  PUBLIC_BASE_URL?: string;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, accept, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const store = new PlanStore(env.DB);

    if (pathname === "/mcp") {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      const baseUrl = (env.PUBLIC_BASE_URL ?? url.origin).replace(/\/$/, "");
      const handler = createMcpHandler(() => createServer({ store, baseUrl }));
      const res = await handler.fetch(req);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
    if (pathname === "/api/waitlist") return handleWaitlist(req, env.WAITLIST, "roomwise");
    if (pathname === "/api/plans" || pathname.startsWith("/api/plans/")) return handlePlansApi(req, store, { kinds: ["room"], validate: (_k, d) => validateRoomPlan(d) });
    if (pathname === "/.well-known/openai-apps-challenge") return handleChallenge(env.OPENAI_APPS_CHALLENGE);
    if (pathname.startsWith("/p/")) {
      // The editor shell is the same for every plan; it reads the id from the URL and the manage token from the #fragment.
      const shell = await env.ASSETS.fetch(new Request(new URL("/app/", url), { method: "GET", headers: req.headers }));
      const headers = new Headers(shell.headers);
      headers.set("referrer-policy", "no-referrer");
      headers.set("cache-control", "no-store");
      return new Response(shell.body, { status: shell.status, headers });
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    await new PlanStore(env.DB).purgeExpired();
  },
};

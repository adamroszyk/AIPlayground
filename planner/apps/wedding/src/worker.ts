import { handleChallenge, handleWaitlist, type KV } from "@planner/core";

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  WAITLIST: KV;
  /** Set with `wrangler secret put OPENAI_APPS_CHALLENGE` once the OpenAI portal shows the token. */
  OPENAI_APPS_CHALLENGE?: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/waitlist") return handleWaitlist(req, env.WAITLIST, "aisle");
    if (pathname === "/.well-known/openai-apps-challenge") return handleChallenge(env.OPENAI_APPS_CHALLENGE);
    return env.ASSETS.fetch(req);
  },
};

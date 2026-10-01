# Progress log

## 2026-10-01: P0 and P1 complete

- **P0** Plan written (`docs/plan/app-generation-plan.md`). Spike confirmed an MCP server runs under the Workers runtime (`workerd`) via `createMcpHandler`.
- **P1** `planner/` workspace with a shared site kit and two branded landing sites (Roomwise, Aisle): landing, privacy, terms, support, sitemap, robots, CSP headers, KV waitlist (dedupe, honeypot, size limits), `/.well-known/openai-apps-challenge` route (404 until the secret is set).
  - Verified: `npm run test:landing` runs both apps on `workerd` and drives them in Chromium: 44 checks pass (waitlist behaviour, legal pages, CSP console-clean, mobile no-overflow). Screenshot review found and fixed three visual bugs the assertions missed (header button contrast, tiny illustration text, clipped dimension label).
- Pending your input: publisher name, contact email, domains (see plan section 7). Pages show placeholders until `PUBLISHER_NAME`, `CONTACT_EMAIL`, `SITE_URL` are set.

Next: P2 engine.

# Toolbox

Five simple, high-search-intent utilities (QR code, word counter, password generator, age/date calculator,
mortgage/loan calculator) built once and shipped two ways:

1. **Static landing pages**, one per tool, each with a working in-browser tool, FAQ, and schema.org markup (`site/`).
2. **One MCP server** that exposes the same functions to ChatGPT, Claude and Grok (`src/server/`).

Why these five, and why not the others: [`docs/research/ideas.md`](../docs/research/ideas.md).
How to get listed in each assistant: [`docs/integration.md`](../docs/integration.md).

## Layout

```
src/core/     pure functions + unit tests (shared by site and server)
src/server/   MCP server (Streamable HTTP, stateless) + live-server tests
src/widget/   the QR code MCP App view (bundled to dist/qr-widget.html)
site/         page content (tools.ts), renderer (client.ts), generator (build.ts), css
scripts/      widget bundler
```

## Run

```bash
npm install
npm test                 # unit + live-server tests
npm run typecheck
npm start                # builds the widget, serves MCP at http://localhost:3000/mcp  (GET /healthz)
SITE_URL=https://yourdomain.com MCP_URL=https://yourdomain.com/mcp CONTACT_EMAIL=you@yourdomain.com npm run build:site
```

Requires Node ≥ 22.18 (runs TypeScript directly). Static site output is `dist/site/`: host it anywhere.

Try the server locally with the MCP Inspector: `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3000/mcp`.

## Design notes

- Tools are pure and stateless; nothing is stored or logged, which keeps the privacy policy short and the server trivially scalable.
- Tool failures come back as `isError` results so the model can read the reason and retry.
- Browser tools never send input anywhere; the privacy page distinguishes that from the chat connector.

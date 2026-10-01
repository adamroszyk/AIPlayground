import { createServer as createHttpServer } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer, SERVER_INFO } from "./tools.ts";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY = 5 * 1024 * 1024;

/**
 * Stateless Streamable HTTP: a fresh server + transport per request. Every tool is a pure function, so there is
 * no session state to keep, which also makes the server trivial to scale horizontally or run on serverless.
 */
const http = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Cross-origin access is needed by browser-based MCP clients (e.g. MCP Inspector, ChatGPT's connector tester).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id, mcp-protocol-version, accept, last-event-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  if (url.pathname === "/healthz") return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, ...SERVER_INFO }));

  if (url.pathname !== "/mcp") return void res.writeHead(404, { "content-type": "text/plain" }).end("Not found. MCP endpoint is /mcp");

  if (req.method !== "POST") {
    // Stateless mode has no server-initiated stream or session to delete.
    return void res.writeHead(405, { allow: "POST, OPTIONS", "content-type": "application/json" }).end(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }),
    );
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) return void res.writeHead(413).end();
    chunks.push(c as Buffer);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return void res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
  }

  const server = createServer();
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error("MCP request failed:", e);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
  }
});

http.listen(PORT, () => console.log(`toolbox MCP server listening on http://localhost:${PORT}/mcp`));

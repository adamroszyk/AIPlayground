// Demo host page: shows the prompt, the tool call and its result next to the real widget, rendered through an MCP Apps host.
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const q = new URLSearchParams(location.search);
const SERVER = q.get("server")!, TOOL = q.get("tool")!, URI = q.get("uri")!, PROMPT = q.get("prompt")!;
const ARGS = JSON.parse(q.get("args")!);
const $ = (id: string) => document.getElementById(id)!;

(async () => {
  const rpc = async (method: string, p: unknown) => {
    const r = await fetch(`${SERVER}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: p }) });
    const raw = await r.text();
    return JSON.parse(raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data:"))!.slice(5)).result;
  };
  $("prompt").textContent = PROMPT;
  $("tool").textContent = TOOL;
  $("args").textContent = JSON.stringify(ARGS, null, 1).split("\n").slice(0, 26).join("\n") + "\n …";
  const html = (await rpc("resources/read", { uri: URI })).contents[0].text;
  const t0 = performance.now();
  const result = await rpc("tools/call", { name: TOOL, arguments: ARGS });
  $("ms").textContent = `${Math.round(performance.now() - t0)} ms`;
  const lines = String(result.content[0].text).split("\n");
  $("res").textContent = lines.slice(0, 17).join("\n") + (lines.length > 17 ? "\n …" : "");
  const iframe = document.getElementById("w") as HTMLIFrameElement;
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.srcdoc = html;
  const bridge = new AppBridge(null, { name: "demo-host", version: "0" }, { serverTools: {}, openLinks: {} } as never);
  bridge.onopenlink = async (p: { url: string }) => { location.href = p.url; return {}; };
  bridge.oninitialized = () => void bridge.sendToolResult(result);
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
})();

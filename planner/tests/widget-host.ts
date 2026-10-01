// Minimal MCP Apps host for tests: loads a widget resource into a sandboxed iframe and feeds it a real tool result.
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const params = new URLSearchParams(location.search);
const SERVER = params.get("server")!;
const TOOL = params.get("tool")!;
const URI = params.get("uri")!;
const ARGS = JSON.parse(params.get("args")!);

(async () => {
  const rpc = async (method: string, p: unknown) => {
    const r = await fetch(`${SERVER}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: p }) });
    const raw = await r.text();
    return JSON.parse(raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data:"))!.slice(5)).result;
  };
  const html = (await rpc("resources/read", { uri: URI })).contents[0].text;
  const result = await rpc("tools/call", { name: TOOL, arguments: ARGS });
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.style.cssText = "width:560px;height:760px;border:1px solid #ccc";
  iframe.srcdoc = html;
  document.body.append(iframe);
  const bridge = new AppBridge(null, { name: "test-host", version: "0" }, { serverTools: {}, openLinks: {} } as never);
  (window as unknown as { __opened: string[] }).__opened = [];
  bridge.onopenlink = async (p: { url: string }) => { (window as unknown as { __opened: string[] }).__opened.push(p.url); return {}; };
  bridge.oninitialized = () => void bridge.sendToolResult(result);
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
})();

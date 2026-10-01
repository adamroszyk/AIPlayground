import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const out = await build({ entryPoints: ["src/widget/qr.ts"], bundle: true, write: false, format: "iife", minify: true, target: "es2022", platform: "browser" });
// "</script" inside the bundle would end the inline script early.
const js = out.outputFiles[0]!.text.replaceAll("</script", "<\\/script");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 16px; font: 14px/1.4 system-ui, sans-serif; text-align: center; }
  img { width: min(100%, 280px); height: auto; image-rendering: pixelated; border-radius: 8px; }
  p { margin: 8px 0; word-break: break-all; opacity: .8; }
  a { color: inherit; }
</style></head>
<body><div id="root">Creating QR code…</div><script>${js}</script></body></html>`;

await mkdir("dist", { recursive: true });
await writeFile("dist/qr-widget.html", html);
console.log(`dist/qr-widget.html (${(html.length / 1024).toFixed(0)} KB)`);

import type { Files } from "./zip.ts";

export interface LintResult { errors: string[]; warnings: string[] }
export interface LintOptions {
  /** Treat placeholders and missing publish-time material as errors. */
  release?: boolean;
  /** Tool names the live server exposes; positive cases may only reference these. */
  toolNames?: string[];
}

const HTTPS = (s: unknown, max: number): s is string => {
  if (typeof s !== "string" || s.length > max) return false;
  try { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
};
const isStr = (v: unknown): v is string => typeof v === "string";
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

const SECRET = /(sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._-]{16,}|api[_-]?key\s*[:=]\s*\S{8,}|client_secret|password\s*[:=]\s*\S+)/i;
const PLACEHOLDER = /example\.(com|org|net)|\[Publisher name\]|\byour[- ]domain\b|\bTODO\b|lorem ipsum/i;

function imageSize(name: string, data: Buffer): { w: number; h: number } | string {
  if (name.endsWith(".png")) {
    if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) return "is not a valid PNG";
    return { w: data.readUInt32BE(16), h: data.readUInt32BE(20) };
  }
  if (name.endsWith(".svg")) {
    const s = data.toString("utf8");
    const vb = /viewBox\s*=\s*"\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/.exec(s);
    const w = /<svg[^>]*\swidth="([\d.]+)"/.exec(s), h = /<svg[^>]*\sheight="([\d.]+)"/.exec(s);
    if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
    if (vb) return { w: Number(vb[1]), h: Number(vb[2]) };
    return "needs numeric width/height or a viewBox";
  }
  if (/\.(jpe?g)$/.test(name)) {
    for (let i = 2; i + 9 < data.length; ) {
      if (data[i] !== 0xff) { i++; continue; }
      const m = data[i + 1]!;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: data.readUInt16BE(i + 5), w: data.readUInt16BE(i + 7) };
      i += 2 + data.readUInt16BE(i + 2);
    }
    return "is not a valid JPEG";
  }
  if (name.endsWith(".webp")) {
    if (data.toString("ascii", 0, 4) !== "RIFF") return "is not a valid WebP";
    const kind = data.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: 1 + data.readUIntLE(24, 3), h: 1 + data.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { w: data.readUInt16LE(26) & 0x3fff, h: data.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") { const b = data.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    return "has an unknown WebP layout";
  }
  return "has an unsupported format (use PNG, JPEG, WebP or SVG)";
}

/** Checks a built plugin package against the rules in OpenAI's "Upload and submit your plugin" page. */
export function lintPlugin(files: Files, opt: LintOptions = {}): LintResult {
  const errors: string[] = [], warnings: string[] = [];
  const err = (m: string) => errors.push(m);
  const placeholder = (m: string) => (opt.release ? errors : warnings).push(m);
  const text = (p: string) => files.get(p)?.toString("utf8");

  // --- layout ---
  for (const p of files.keys()) {
    if (p.startsWith("/") || p.includes("..") || p.includes("\\")) err(`Unsafe path in ZIP: ${p}`);
    if (p.startsWith("__MACOSX/") || p.endsWith(".DS_Store")) err(`Remove OS metadata file: ${p}`);
    if (/(^|\/)\.app\.json$/.test(p)) err(`App references are not allowed in a submitted ZIP (${p}).`);
    if (/^hooks\//.test(p) || /(^|\/)hooks\.json$/.test(p)) err(`Lifecycle hooks are not allowed in a submitted ZIP (${p}).`);
    if (/(^|\/)\.env/.test(p) || /\.(pem|key)$/.test(p)) err(`Possible credential file in the package: ${p}`);
  }
  const roots = new Set([...files.keys()].map((p) => p.split("/")[0]));
  if (!files.has("plugin.json") && [...roots].length === 1 && files.has(`${[...roots][0]}/plugin.json`)) err("plugin.json must be at the root of the ZIP, not inside a folder.");

  const raw = text("plugin.json");
  if (!raw) { err("Missing plugin.json at the ZIP root."); return { errors, warnings }; }
  let m: Record<string, unknown>;
  try { m = obj(JSON.parse(raw)); } catch (e) { err(`plugin.json is not valid JSON: ${(e as Error).message}`); return { errors, warnings }; }

  // --- secrets and forbidden keys, anywhere in any text file ---
  for (const [p, data] of files) {
    if (/\.(json|md|txt|svg|ya?ml)$/.test(p) && SECRET.test(data.toString("utf8"))) err(`Possible credential in ${p}. Reviewer access goes in the dashboard, never in the package.`);
  }
  const scan = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (k === "test_credentials" || k === "reviewer_instructions") err(`${path}.${k} is rejected by upload. Enter reviewer access in the dashboard.`);
      if (path === "plugin.json" && (k === "apps" || k === "hooks")) err(`plugin.json must not declare "${k}".`);
      scan(x, `${path}.${k}`);
    }
  };
  scan(m, "plugin.json");

  // --- identity ---
  if (m.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") err('plugin.json "$schema" must be https://agent-plugins.org/schemas/1.0.0/plugin.schema.json.');
  if (!isStr(m.name) || m.name.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.name)) err('"name" must be at most 64 characters: lowercase letters, numbers and single hyphens.');
  if (!isStr(m.version) || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(m.version)) err('"version" must be a semantic version such as 1.0.0.');
  if (!isStr(m.description) || m.description.length === 0 || m.description.length > 4000) err('"description" is required and at most 4000 characters.');
  const author = obj(m.author);
  if (!isStr(author.name) || !author.name || author.name.length > 120) err("author.name is required, at most 120 characters.");
  if (author.email !== undefined && (!isStr(author.email) || author.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author.email))) err("author.email is not a valid address.");
  if (author.url !== undefined && !HTTPS(author.url, 2048)) err("author.url must be an HTTPS URL.");
  if (m.homepage !== undefined && !HTTPS(m.homepage, 2048)) err("homepage must be an HTTPS URL of at most 2048 characters.");

  // --- MCP configuration: exactly one remote server ---
  const mcpRaw = text("mcp.json");
  let serverName = "", serverUrl = "";
  if (!mcpRaw) err("Missing mcp.json. The MCP server must be in the first ZIP; it cannot be added later.");
  else {
    try {
      const mcp = obj(JSON.parse(mcpRaw));
      if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") err('mcp.json "$schema" must be https://agent-plugins.org/schemas/1.0.0/mcp.schema.json.');
      const servers = Object.entries(obj(mcp.mcpServers));
      if (servers.length !== 1) err(`mcp.json must declare exactly one MCP server (found ${servers.length}).`);
      for (const [n, s] of servers) {
        const sv = obj(s);
        serverName = n; serverUrl = String(sv.url ?? "");
        if (sv.type !== "streamable-http") err(`MCP server "${n}" must use type "streamable-http".`);
        if (!HTTPS(sv.url, 1024)) err(`MCP server "${n}" needs an HTTPS url without embedded credentials.`);
        else {
          const u = new URL(String(sv.url));
          if (u.search || u.hash) err(`MCP url must not carry query parameters or fragments (${sv.url}); secrets in URLs are exposed.`);
          if (!/\/mcp\/?$/.test(u.pathname)) warnings.push(`MCP url path is ${u.pathname}; the usual path is /mcp.`);
          if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) err("MCP url points at a local address.");
          if (PLACEHOLDER.test(u.hostname)) placeholder(`MCP url ${sv.url} uses a placeholder host. The MCP URL cannot be changed after the first upload without OpenAI support.`);
        }
        if (sv.headers || sv.env || sv.oauth || sv.auth) err(`MCP server "${n}" must not carry headers, env or auth settings in the package.`);
      }
    } catch (e) { err(`mcp.json is not valid JSON: ${(e as Error).message}`); }
  }

  // --- listing ---
  const ext = obj(obj(m.extensions)["com.openai"]);
  const ui = obj(ext.interface);
  const need = (k: string, max: number) => { const v = ui[k]; if (!isStr(v) || !v.trim()) err(`interface.${k} is required.`); else if (v.length > max) err(`interface.${k} is ${v.length} characters; the limit is ${max}.`); };
  need("displayName", 30); need("shortDescription", 30); need("longDescription", 4000); need("developerName", 80); need("category", 100);
  if (isStr(ui.shortDescription) && /\n/.test(ui.shortDescription)) err("interface.shortDescription must be a single line.");
  if (isStr(ui.developerName) && isStr(author.name) && ui.developerName !== author.name) err(`interface.developerName ("${ui.developerName}") must equal author.name ("${author.name}").`);
  for (const k of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) if (!HTTPS(ui[k], 1024)) err(`interface.${k} must be an HTTPS URL (at most 1024 characters, no credentials). All four listing URLs are required for MCP review.`);
  if (Array.isArray(ui.capabilities) && (ui.capabilities.length > 20 || ui.capabilities.some((c) => !isStr(c) || c.length > 120))) err("interface.capabilities: at most 20 entries of at most 120 characters.");
  const prompts = ui.defaultPrompt === undefined ? [] : Array.isArray(ui.defaultPrompt) ? ui.defaultPrompt : [ui.defaultPrompt];
  if (prompts.length > 3) err("interface.defaultPrompt: at most three prompts.");
  if (new Set(prompts).size !== prompts.length) err("interface.defaultPrompt: prompts must be unique.");
  for (const p of prompts) { if (!isStr(p) || p.length > 128) err("interface.defaultPrompt: each prompt is at most 128 characters."); else if (/@\w/.test(p)) err(`interface.defaultPrompt: omit @mentions ("${p}").`); }
  if (ui.brandColor !== undefined) { if (!isStr(ui.brandColor) || !/^#[0-9a-fA-F]{6}$/.test(ui.brandColor)) err("interface.brandColor must be #RRGGBB."); else if (contrast(ui.brandColor, "#ffffff") < 2) err(`interface.brandColor ${ui.brandColor} has contrast ${contrast(ui.brandColor, "#ffffff").toFixed(2)}:1 against white; it needs at least 2:1.`); }
  if (ui.brandColorDark !== undefined) { if (!isStr(ui.brandColorDark) || !/^#[0-9a-fA-F]{6}$/.test(ui.brandColorDark)) err("interface.brandColorDark must be #RRGGBB."); else if (contrast(ui.brandColorDark, "#212121") < 2) err(`interface.brandColorDark ${ui.brandColorDark} has contrast ${contrast(ui.brandColorDark, "#212121").toFixed(2)}:1 against #212121; it needs at least 2:1.`); }
  if (isStr(ui.websiteURL) && serverUrl) { try { if (new URL(ui.websiteURL).host !== new URL(serverUrl).host) warnings.push("websiteURL and the MCP URL are on different hosts. The domain-verification token is per hostname, so verify the MCP host."); } catch { /* reported above */ } }

  // --- OpenAI plugin guidelines: names, descriptions and claims ---
  if (isStr(ui.displayName) && /\b(mcp|plugin|server)\b/i.test(ui.displayName)) err('interface.displayName must not contain "MCP", "Server" or "Plugin". Use the product name on its own.');
  const prose: [string, unknown][] = [["interface.displayName", ui.displayName], ["interface.shortDescription", ui.shortDescription], ["interface.longDescription", ui.longDescription], ["description", m.description], ...prompts.map((p, i): [string, unknown] => [`interface.defaultPrompt[${i}]`, p])];
  const PRICING = /\b(free|freemium|discounts?|promo\w*|coupons?|subscriptions?|trials?)\b|[$€£]\s?\d|\d\s?% off/i;
  const CLAIMS = /(?:^|\W)#1(?:\W|$)|\b(best|number one|leading|top[- ]rated|world[- ]class|better than|faster than|unlike|alternative to|instead of just|beats?)\b/i;
  for (const [k, v] of prose) {
    if (!isStr(v)) continue;
    const price = PRICING.exec(v), claim = CLAIMS.exec(v);
    if (price) err(`${k} mentions "${price[0].trim()}". The guidelines do not allow advertising pricing, subscriptions, free trials, discounts or promotions.`);
    if (claim) err(`${k} says "${claim[0].trim()}". The guidelines require descriptions without comparisons to other products or unverifiable claims.`);
  }

  // --- images ---
  const imgs: [string, unknown, boolean][] = [["logo", ui.logo, true], ["composerIcon", ui.composerIcon, true], ["logoDark", ui.logoDark, false], ["composerIconDark", ui.composerIconDark, false]];
  for (const s of Array.isArray(ui.screenshots) ? ui.screenshots : []) imgs.push(["screenshots[]", s, false]);
  if (!ui.logo) err("interface.logo is required (the dashboard needs a primary app icon).");
  if (!ui.composerIcon) warnings.push("interface.composerIcon is missing; Codex packages require it.");
  for (const [k, ref, square] of imgs) {
    if (ref === undefined) continue;
    if (!isStr(ref) || !ref.startsWith("./")) { err(`interface.${k} must be a ./-prefixed relative path.`); continue; }
    const path = ref.slice(2), data = files.get(path);
    if (!data) { err(`interface.${k} points at ${ref}, which is not in the package.`); continue; }
    if (data.length > 5 * 1024 * 1024) err(`${path} is larger than 5 MiB.`);
    const size = imageSize(path, data);
    if (typeof size === "string") { err(`${path} ${size}.`); continue; }
    if (square && size.w !== size.h) err(`${path} must be square (it is ${size.w}x${size.h}).`);
    if (square && (size.w < 48 || size.h < 48)) err(`${path} must be at least 48x48 (it is ${size.w}x${size.h}).`);
    if (!path.endsWith(".svg") && (size.w > 4096 || size.h > 4096)) err(`${path} is larger than 4096 pixels.`);
  }

  // --- onboarding skill ---
  const skillRef = ext.onboardingSkill;
  const skills = [...files.keys()].filter((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p));
  if (skills.length === 0) warnings.push("No skills/*/SKILL.md in the package.");
  for (const s of skills) {
    const head = /^---\n([\s\S]*?)\n---/.exec(text(s) ?? "")?.[1] ?? "";
    if (!/^name:\s*\S+/m.test(head) || !/^description:\s*\S+/m.test(head)) err(`${s} needs YAML front matter with name and description.`);
  }
  if (skillRef !== undefined && (!isStr(skillRef) || !files.has(skillRef.replace(/^\.\//, "")))) err("onboardingSkill must point at a SKILL.md included in the package.");

  // --- review ---
  const review = obj(ext.review), cases = obj(review.test_cases);
  const pos = Array.isArray(cases.positive) ? cases.positive : [], neg = Array.isArray(cases.negative) ? cases.negative : [];
  if (pos.length !== 5) err(`review.test_cases.positive must have exactly 5 cases (found ${pos.length}).`);
  if (neg.length !== 3) err(`review.test_cases.negative must have exactly 3 cases (found ${neg.length}).`);
  pos.forEach((c, i) => {
    const o = obj(c);
    for (const k of ["description", "prompt", "tools_triggered", "expected_behavior"]) if (!isStr(o[k]) || !String(o[k]).trim()) err(`positive case ${i + 1} is missing ${k}.`);
    if (isStr(o.description) && o.description.length > 4000) err(`positive case ${i + 1} description is over 4000 characters.`);
    if (isStr(o.tools_triggered) && opt.toolNames) for (const t of o.tools_triggered.split(",").map((x) => x.trim()).filter(Boolean)) if (!opt.toolNames.includes(t)) err(`positive case ${i + 1} expects tool "${t}", which the server does not expose.`);
  });
  neg.forEach((c, i) => { const o = obj(c); if (!isStr(o.description) || !isStr(o.prompt) || !o.prompt.trim()) err(`negative case ${i + 1} needs description and prompt.`); });
  if (new Set([...pos, ...neg].map((c) => obj(c).prompt)).size !== pos.length + neg.length) err("Test case prompts must be unique.");
  if (review.demo_recording_url === undefined || review.demo_recording_url === "") placeholder("review.demo_recording_url is not set. A reviewer-accessible demo video is required to submit.");
  else if (!HTTPS(review.demo_recording_url, 2048)) err("review.demo_recording_url must be an HTTPS URL.");
  if (typeof review.commerce !== "boolean") err("review.commerce must be true or false.");
  const pub = obj(ext.publication);
  if (!isStr(pub.release_notes) || !pub.release_notes.trim()) warnings.push("publication.release_notes is empty.");
  if (pub.countries !== undefined && (!Array.isArray(pub.countries) || pub.countries.some((c) => !isStr(c) || !/^[A-Z]{2}$/.test(c)))) err("publication.countries must be uppercase two-letter codes.");
  for (const [loc, t] of Object.entries(obj(pub.translations))) {
    const o = obj(t);
    if (isStr(o.subtitle) && (o.subtitle.length > 30 || /\n/.test(o.subtitle))) err(`translations.${loc}.subtitle must be one line of at most 30 characters.`);
    if (isStr(o.description) && o.description.length > 4000) err(`translations.${loc}.description is over 4000 characters.`);
  }

  // --- placeholders (only errors in release mode) ---
  const listing = JSON.stringify({ author, ui, homepage: m.homepage });
  if (PLACEHOLDER.test(listing)) placeholder(`The listing still has placeholder values (${(PLACEHOLDER.exec(listing) ?? [""])[0]}). Set PUBLISHER_NAME, CONTACT_EMAIL and the real hostname before submitting.`);
  if (!isStr(author.email) || !author.email) placeholder("author.email is not set (set CONTACT_EMAIL).");
  void serverName;
  return { errors, warnings };
}

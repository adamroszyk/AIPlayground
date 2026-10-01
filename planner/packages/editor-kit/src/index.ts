// Browser-only helpers shared by both editors. No Node imports. User text only ever goes through textContent.

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "text") node.textContent = String(v);
    else if (k in node && k !== "list" && k !== "form") (node as unknown as Record<string, unknown>)[k] = v;
    else node.setAttribute(k, String(v));
  }
  node.append(...kids);
  return node;
}

let uid = 0;
export function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  const id = `f${++uid}`;
  input.id = id;
  return el("div", { class: "field" }, el("label", { htmlFor: id, text: label }), input, ...(hint ? [el("small", { text: hint })] : []));
}

export interface Loc { id?: string; token?: string }
/** `/p/<id>` plus an optional `#k=<manage token>` fragment. The fragment never reaches the server. */
export function parseLocation(): Loc {
  const m = /^\/p\/([A-Za-z0-9_-]{16,64})\/?$/.exec(location.pathname);
  const k = /(?:^|[#&])k=([A-Za-z0-9_-]{16,64})/.exec(location.hash);
  return { id: m?.[1], token: k?.[1] };
}

export interface LoadedPlan<T> { id: string; kind: string; data: T; updatedAt: number; expiresAt: number }

async function call(method: string, url: string, body?: unknown, token?: string): Promise<Response> {
  return fetch(url, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { "x-manage-token": token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function problem(res: Response, fallback: string): Promise<Error> {
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(j.error ?? fallback);
}

export const planApi = {
  async load<T>(id: string): Promise<LoadedPlan<T>> {
    const r = await call("GET", `/api/plans/${id}`);
    if (!r.ok) throw r.status === 404 ? new Error("This plan was not found. Plans are deleted 90 days after their last edit.") : await problem(r, "Could not load the plan");
    return (await r.json()) as LoadedPlan<T>;
  },
  async create(kind: string, data: unknown): Promise<{ id: string; manageToken: string }> {
    const r = await call("POST", "/api/plans", { kind, data });
    if (!r.ok) throw await problem(r, "Could not save the plan");
    return (await r.json()) as { id: string; manageToken: string };
  },
  async save(id: string, token: string, data: unknown): Promise<void> {
    const r = await call("PUT", `/api/plans/${id}`, { data }, token);
    if (!r.ok) throw r.status === 403 ? new Error("This link cannot edit the plan. Open the edit link you were given.") : await problem(r, "Could not save the plan");
  },
  async remove(id: string, token: string): Promise<void> {
    const r = await call("DELETE", `/api/plans/${id}`, undefined, token);
    if (!r.ok) throw r.status === 403 ? new Error("This link cannot delete the plan.") : await problem(r, "Could not delete the plan");
  },
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadFile(name: string, mime: string, content: string): void {
  const a = el("a", { href: URL.createObjectURL(new Blob([content], { type: mime })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function setStatus(node: HTMLElement, text: string, kind: "ok" | "err" | "" = ""): void {
  node.textContent = text;
  node.className = `status ${kind}`;
}

export const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const EDITOR_CSS = `
.editor{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:28px;padding:28px 0 60px;align-items:start}
@media(max-width:900px){.editor{grid-template-columns:1fr}#main{order:-1}}
.panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h2{font-size:18px;margin:0 0 10px}.panel h3{font-size:15px;margin:14px 0 6px}
.field{margin:0 0 10px}.field label{display:block;font-size:13px;font-weight:600;margin-bottom:3px}.field small{color:var(--muted);font-size:12px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px}.row .field{flex:1 1 70px;margin:0}
.editor input[type=text],.editor input[type=number],.editor input[type=time],.editor select,.editor textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;font-size:15px}
.editor textarea{min-height:140px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.45}
.editor button{padding:9px 14px;border-radius:999px;border:0;background:var(--accent);color:var(--accent-fg);font:600 14px system-ui;cursor:pointer}
.editor button.secondary{background:transparent;color:var(--fg);border:1px solid var(--line)}.editor button.danger{background:transparent;color:var(--err);border:1px solid var(--err)}
.editor button:disabled{opacity:.5;cursor:not-allowed}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.status{font-size:14px;color:var(--muted);margin:0}.status.ok{color:var(--ok)}.status.err{color:var(--err)}
.banner{background:var(--card);border-left:4px solid var(--accent);padding:10px 14px;border-radius:0 10px 10px 0;margin-bottom:14px;font-size:15px}
.canvas{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;touch-action:none;user-select:none}
.canvas svg{display:block;max-width:100%;height:auto}
.canvas .rp-piece,.canvas .rp-seatg{cursor:grab}.canvas .rp-sel rect:first-child{stroke:var(--accent);stroke-width:3}
.rchecks{list-style:none;padding:0;margin:8px 0 0}.rchecks li{padding:4px 0 4px 24px;position:relative;font-size:14px}
.rchecks li:before{position:absolute;left:0;font-weight:700}.rchecks .ok:before{content:"\\2713";color:var(--ok)}.rchecks .no:before{content:"\\2717";color:var(--err)}
.rchecks .no{color:var(--err)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:14px}.kv dt{color:var(--muted)}.kv dd{margin:0;font-variant-numeric:tabular-nums}
.help{font-size:13px;color:var(--muted)}
.editor{--rp-floor:var(--floor);--rp-wall:var(--fg);--rp-text:var(--fg);--rp-muted:var(--muted);--rp-item:var(--item);--rp-item-big:var(--item2);--rp-item-line:var(--item-line);--rp-accent:var(--accent2);--rp-bg:var(--bg);--rp-g1:var(--g1,#7b2d5b);--rp-g2:var(--g2,#d98aa6);--rp-g3:var(--g3,#3f8f8a);--rp-g4:var(--g4,#c99a3e);--rp-g5:var(--g5,#6b7fb3)}
.dragging{opacity:.85}.drop{stroke:var(--accent)!important;stroke-width:3!important}
@media print{header.top,footer,.panel,.toolbar,.banner{display:none!important}.editor{display:block}.canvas{border:0}}
`;

export const WEDDING_EDITOR_CSS = `
.rulehelp{margin:0;padding-left:18px}
.rp-legend span{display:inline-flex;align-items:center}
.canvas .rp-seatg .rp-seat{cursor:grab}.canvas .rp-seatg.rp-sel .rp-seat{stroke:var(--accent);stroke-width:3}
.canvas .rp-seatg.dragging{pointer-events:none;opacity:.8}
.conflict{border-color:var(--err)}.conflict ul,.warn{margin:6px 0 0;padding-left:18px;font-size:14px}.warn{color:var(--err)}
.tl{border-collapse:collapse;width:100%;font-size:14px}.tl td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}.tl td:first-child{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
@media print{.rp-legend{display:flex}}
`;

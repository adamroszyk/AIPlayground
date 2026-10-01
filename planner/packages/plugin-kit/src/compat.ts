/**
 * OpenAI reviews tool metadata once and holds changes. A deployment must stay compatible with the approved schemas:
 * only additive, optional changes are safe. This compares the live `tools/list` output with a committed snapshot.
 */
export interface ToolDef { name: string; title?: string; description?: string; annotations?: Record<string, unknown>; inputSchema?: Schema; _meta?: Record<string, unknown> }
export interface Schema { type?: string | string[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema; enum?: unknown[]; const?: unknown; oneOf?: Schema[]; anyOf?: Schema[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number; [k: string]: unknown }
export interface Compat { breaking: string[]; held: string[] }

const types = (s: Schema) => (Array.isArray(s.type) ? s.type : s.type ? [s.type] : []);

function schemaProblems(a: Schema | undefined, b: Schema | undefined, path: string, out: string[]) {
  if (!a) return;
  if (!b) { out.push(`${path}: removed`); return; }
  const variants = a.oneOf ?? a.anyOf;
  if (variants) {
    const next = b.oneOf ?? b.anyOf ?? [];
    variants.forEach((v, i) => { const probs: string[][] = next.map((n) => { const p: string[] = []; schemaProblems(v, n, `${path}|${i}`, p); return p; }); if (!probs.some((p) => p.length === 0)) out.push(`${path}: variant ${i + 1} (${JSON.stringify(v.properties?.type?.const ?? v.type ?? "?")}) is no longer accepted`); });
    return;
  }
  const ta = types(a), tb = types(b);
  if (ta.length && !ta.every((t) => tb.includes(t) || (t === "integer" && tb.includes("number")))) out.push(`${path}: type changed from ${ta.join("|")} to ${tb.join("|") || "any"}`);
  if (a.enum && b.enum && !a.enum.every((v) => b.enum!.includes(v))) out.push(`${path}: enum values were removed`);
  if (a.enum && !b.enum && b.const !== undefined) out.push(`${path}: enum narrowed to a constant`);
  if (a.const !== undefined && b.const !== a.const && !(b.enum ?? []).includes(a.const)) out.push(`${path}: constant changed`);
  for (const [k, dir] of [["minimum", "min"], ["minLength", "min"], ["minItems", "min"], ["maximum", "max"], ["maxLength", "max"], ["maxItems", "max"]] as const) {
    const x = a[k] as number | undefined, y = b[k] as number | undefined;
    if (dir === "min" && y !== undefined && (x === undefined || y > x)) out.push(`${path}: ${k} raised to ${y}`);
    if (dir === "max" && y !== undefined && (x === undefined || y < x)) out.push(`${path}: ${k} lowered to ${y}`);
  }
  for (const [k, pa] of Object.entries(a.properties ?? {})) schemaProblems(pa, b.properties?.[k], `${path}.${k}`, out);
  for (const r of b.required ?? []) if (!(a.required ?? []).includes(r)) out.push(`${path}.${r}: became required`);
  if (a.items) schemaProblems(a.items, b.items, `${path}[]`, out);
}

export function compareTools(approved: ToolDef[], live: ToolDef[]): Compat {
  const breaking: string[] = [], held: string[] = [];
  const byName = new Map(live.map((t) => [t.name, t]));
  for (const old of approved) {
    const t = byName.get(old.name);
    if (!t) { breaking.push(`${old.name}: tool removed or renamed`); continue; }
    schemaProblems(old.inputSchema, t.inputSchema, old.name, breaking);
    for (const k of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) if (old.annotations?.[k] !== t.annotations?.[k]) breaking.push(`${old.name}: annotation ${k} changed from ${old.annotations?.[k]} to ${t.annotations?.[k]}`);
    if (old.title !== t.title) held.push(`${old.name}: title changed`);
    if (old.description !== t.description) held.push(`${old.name}: description changed (held for review until approved)`);
    if (JSON.stringify(old._meta ?? {}) !== JSON.stringify(t._meta ?? {})) held.push(`${old.name}: _meta changed`);
  }
  const known = new Set(approved.map((t) => t.name));
  for (const t of live) if (!known.has(t.name)) held.push(`${t.name}: new tool (unavailable until approved)`);
  return { breaking, held };
}

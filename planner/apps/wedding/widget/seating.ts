import { App } from "@modelcontextprotocol/ext-apps";
import { seatingGroups, seatingToSvg, SEATING_CSS, type Guest, type SeatingReport, type Table } from "@planner/engine";

interface Structured { guests?: Guest[]; tables?: Table[]; seats?: Record<string, string[]>; report?: SeatingReport; editUrl?: string; conflicts?: string[] }

const app = new App({ name: "aisle-seating", version: "1.0.0" });
const root = document.getElementById("root")!;
const style = document.createElement("style");
style.textContent = SEATING_CSS;
document.head.append(style);

app.ontoolresult = (result) => {
  const s = result.structuredContent as Structured | undefined;
  if (result.isError || !s?.guests || !s.tables || !s.seats) {
    const t = (result.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === "text")?.text;
    root.textContent = t ?? "No chart to show.";
    return;
  }
  const failed = (s.report?.results ?? []).filter((r) => !r.ok);
  const bad = failed.flatMap((r) => s.guests!.filter((g) => r.detail.includes(g.name) || r.description.includes(g.name)).map((g) => g.id));
  const wrap = document.createElement("div");
  // seatingToSvg escapes every string it draws, so its output is safe to insert as markup.
  wrap.innerHTML = seatingToSvg(s.tables, s.guests, s.seats, { report: s.report, highlight: bad });
  const legend = document.createElement("div");
  legend.className = "rp-legend";
  for (const g of seatingGroups(s.guests)) {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = g.cls;
    item.append(dot, g.group); // textNode, not markup
    legend.append(item);
  }
  const list = document.createElement("ul");
  list.className = "checks";
  for (const r of s.report?.results ?? []) {
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "no";
    li.textContent = `${r.description}: ${r.detail}`;
    list.append(li);
  }
  root.replaceChildren(wrap, legend, list);
  if (s.editUrl) {
    const url = s.editUrl;
    const btn = document.createElement("button");
    btn.textContent = "Open and adjust on the web";
    btn.onclick = () => void app.openLink({ url });
    root.append(btn);
  }
};

app.connect();

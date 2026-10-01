import { App } from "@modelcontextprotocol/ext-apps";
import { layoutToSvg, PLAN_CSS, type LayoutReport, type Piece, type Placement, type Room } from "@planner/engine";

interface Structured {
  room?: Room;
  pieces?: Piece[];
  placements?: Placement[];
  report?: LayoutReport;
  editUrl?: string;
  viewUrl?: string;
}

const app = new App({ name: "roomwise-plan", version: "1.0.0" });
const root = document.getElementById("root")!;
const style = document.createElement("style");
style.textContent = PLAN_CSS;
document.head.append(style);

app.ontoolresult = (result) => {
  const s = result.structuredContent as Structured | undefined;
  if (result.isError || !s?.room || !s.pieces || !s.placements) {
    const t = (result.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === "text")?.text;
    root.textContent = t ?? "No plan to show.";
    return;
  }
  const bad = (s.report?.results ?? []).filter((r) => !r.ok).flatMap((r) => s.pieces!.filter((p) => r.detail.includes(p.name)).map((p) => p.id));
  const wrap = document.createElement("div");
  // layoutToSvg escapes every string it draws, so its output is safe to insert as markup.
  wrap.innerHTML = layoutToSvg(s.room, s.pieces, s.placements, { report: s.report, highlight: bad });
  const list = document.createElement("ul");
  list.className = "checks";
  for (const r of s.report?.results ?? []) {
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "no";
    li.textContent = `${r.description}: ${r.detail}`;
    list.append(li);
  }
  root.replaceChildren(wrap, list);
  if (s.editUrl) {
    const url = s.editUrl;
    const btn = document.createElement("button");
    btn.textContent = "Open and adjust on the web";
    btn.onclick = () => void app.openLink({ url });
    root.append(btn);
  }
};

app.connect();

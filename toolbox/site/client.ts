import { addDays, calculateAge, calculateLoan, countText, daysBetween, generatePassword, qrSvg } from "../src/core/index.ts";

type Attrs = Record<string, string | number | boolean | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "text") node.textContent = String(v);
    else if (k in node && k !== "list") (node as unknown as Record<string, unknown>)[k] = v;
    else node.setAttribute(k, String(v));
  }
  node.append(...kids);
  return node;
}

let uid = 0;
function field(label: string, input: HTMLElement, hint?: string) {
  const id = `f${++uid}`;
  input.id = id;
  return el("div", { class: "field" }, el("label", { htmlFor: id, text: label }), input, ...(hint ? [el("small", { text: hint })] : []));
}
const num = (v: number, step = "any", min?: number) => el("input", { type: "number", value: v, step, min, inputMode: "decimal" });
const check = (label: string, checked: boolean) => {
  const input = el("input", { type: "checkbox", checked });
  return { input, row: el("label", { class: "check" }, input, ` ${label}`) };
};
const stat = (label: string, value: string) => el("div", { class: "stat" }, el("b", { text: value }), el("span", { text: label }));
const fmt = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const errorBox = (e: unknown) => el("p", { class: "error", role: "alert", text: e instanceof Error ? e.message : String(e) });

function download(name: string, mime: string, data: BlobPart) {
  const a = el("a", { href: URL.createObjectURL(new Blob([data], { type: mime })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- QR ----------
function qr(root: HTMLElement) {
  const text = el("textarea", { rows: 3, value: "https://example.com", maxLength: 2900 });
  const fg = el("input", { type: "color", value: "#000000" });
  const bg = el("input", { type: "color", value: "#ffffff" });
  const ec = el("select", {}, ...["L", "M", "Q", "H"].map((v) => el("option", { value: v, text: { L: "L (7%)", M: "M (15%)", Q: "Q (25%)", H: "H (30%)" }[v], selected: v === "M" })));
  const preview = el("div", { class: "qr-preview", "aria-live": "polite" });
  const buttons = el("div", { class: "row" });
  let svg = "";

  async function render() {
    try {
      svg = await qrSvg({ text: text.value, foreground: fg.value, background: bg.value, errorCorrection: ec.value as "L" });
      preview.replaceChildren(el("img", { alt: "Generated QR code", src: `data:image/svg+xml;base64,${btoa(svg)}` }));
      buttons.hidden = false;
    } catch (e) {
      preview.replaceChildren(errorBox(e));
      buttons.hidden = true;
    }
  }
  const png = el("button", { type: "button", text: "Download PNG" });
  png.onclick = async () => {
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    await img.decode();
    const c = el("canvas", { width: 1024, height: 1024 });
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 1024, 1024);
    c.toBlob((b) => b && download("qr-code.png", "image/png", b));
  };
  const svgBtn = el("button", { type: "button", class: "secondary", text: "Download SVG" });
  svgBtn.onclick = () => download("qr-code.svg", "image/svg+xml", svg);
  buttons.append(png, svgBtn);

  for (const i of [text, fg, bg, ec]) i.addEventListener("input", () => void render());
  root.append(
    el("div", { class: "grid2" },
      el("div", {}, field("Text or URL", text), el("div", { class: "row" }, field("Foreground", fg), field("Background", bg), field("Error correction", ec))),
      el("div", {}, preview, buttons)),
  );
  void render();
}

// ---------- Word counter ----------
function wordCounter(root: HTMLElement) {
  const ta = el("textarea", { rows: 10, placeholder: "Type or paste your text here…", "aria-label": "Text to count" });
  const stats = el("div", { class: "stats", "aria-live": "polite" });
  const keywords = el("p", { class: "muted" });
  const update = () => {
    const s = countText(ta.value);
    stats.replaceChildren(
      stat("Words", fmt(s.words)), stat("Characters", fmt(s.characters)), stat("No spaces", fmt(s.charactersNoSpaces)),
      stat("Sentences", fmt(s.sentences)), stat("Paragraphs", fmt(s.paragraphs)),
      stat("Reading time", s.words === 0 ? "0 min" : s.readingTimeMinutes < 1 ? "< 1 min" : `${s.readingTimeMinutes} min`),
    );
    keywords.textContent = s.topWords.length ? `Top words: ${s.topWords.map((w) => `${w.word} (${w.count})`).join(", ")}` : "";
  };
  ta.addEventListener("input", update);
  root.append(ta, stats, keywords);
  update();
}

// ---------- Password ----------
function password(root: HTMLElement) {
  const length = el("input", { type: "range", min: 8, max: 64, value: 20 });
  const lengthLabel = el("output", { text: "20" });
  const lower = check("a–z", true), upper = check("A–Z", true), digits = check("0–9", true), symbols = check("Symbols", true), amb = check("Exclude look-alikes (O/0, l/1)", false);
  const out = el("output", { class: "password", "aria-live": "polite" });
  const meta = el("p", { class: "muted" });
  const copy = el("button", { type: "button", text: "Copy" });
  const again = el("button", { type: "button", class: "secondary", text: "Generate another" });

  const run = () => {
    lengthLabel.textContent = length.value;
    try {
      const r = generatePassword({ length: Number(length.value), lowercase: lower.input.checked, uppercase: upper.input.checked, digits: digits.input.checked, symbols: symbols.input.checked, excludeAmbiguous: amb.input.checked });
      out.textContent = r.password;
      meta.textContent = `${r.entropyBits} bits of entropy: ${r.strength}`;
      copy.disabled = false;
    } catch (e) {
      out.textContent = "";
      meta.textContent = e instanceof Error ? e.message : String(e);
      copy.disabled = true;
    }
  };
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(out.textContent ?? "");
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select and copy manually";
    }
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  };
  again.onclick = run;
  for (const i of [length, lower.input, upper.input, digits.input, symbols.input, amb.input]) i.addEventListener("input", run);

  root.append(
    out, meta, el("div", { class: "row" }, copy, again),
    el("div", { class: "field" }, el("label", {}, "Length: ", lengthLabel), length),
    el("div", { class: "row" }, lower.row, upper.row, digits.row, symbols.row), amb.row,
  );
  run();
}

// ---------- Age / date ----------
function age(root: HTMLElement) {
  const mode = el("select", {}, el("option", { value: "age", text: "Age from birth date" }), el("option", { value: "diff", text: "Days between two dates" }), el("option", { value: "add", text: "Add or subtract days" }));
  const result = el("div", { class: "stats", "aria-live": "polite" });
  const form = el("div", { class: "row" });
  const date1 = el("input", { type: "date", value: "1990-05-15" });
  const date2 = el("input", { type: "date", value: localToday() });
  const days = el("input", { type: "number", value: 30, step: 1 });
  const inclusive = check("Include both days", false);

  const layout = () => {
    form.replaceChildren(
      ...(mode.value === "age" ? [field("Birth date", date1), field("Age at date", date2)]
        : mode.value === "diff" ? [field("From", date1), field("To", date2), inclusive.row]
        : [field("Start date", date1), field("Days to add (negative to subtract)", days)]),
    );
    run();
  };
  const run = () => {
    try {
      if (mode.value === "age") {
        const a = calculateAge(date1.value, date2.value);
        result.replaceChildren(stat("Years", String(a.years)), stat("Months", String(a.months)), stat("Days", String(a.days)), stat("Total days", fmt(a.totalDays)), stat("Total weeks", fmt(a.totalWeeks)), stat("Next birthday", `${a.nextBirthday} (${fmt(a.daysUntilNextBirthday)} days)`));
      } else if (mode.value === "diff") {
        const d = daysBetween(date1.value, date2.value, inclusive.input.checked);
        result.replaceChildren(stat("Days", fmt(d.days)), stat("Weeks + days", `${d.weeks} w ${d.remainderDays} d`), stat("Weekdays (Mon–Fri)", fmt(d.weekdays)), stat("Approx. months", String(d.approxMonths)));
      } else {
        result.replaceChildren(stat("Result", addDays(date1.value, Number(days.value))));
      }
    } catch (e) {
      result.replaceChildren(errorBox(e));
    }
  };
  for (const i of [mode, date1, date2, days, inclusive.input]) i.addEventListener("input", i === mode ? layout : run);
  root.append(field("Calculator", mode), form, result);
  layout();
}

// ---------- Loan ----------
function loan(root: HTMLElement) {
  const principal = num(350000, "1000", 1), rate = num(6.75, "0.01", 0), years = num(30, "1", 1), extra = num(0, "10", 0), tax = num(0, "10", 0), ins = num(0, "10", 0), hoa = num(0, "10", 0);
  const result = el("div", { class: "stats", "aria-live": "polite" });
  const table = el("div", { class: "table-wrap" });
  const run = () => {
    try {
      const r = calculateLoan({ principal: principal.valueAsNumber, annualRatePercent: rate.valueAsNumber, years: years.valueAsNumber, extraMonthlyPayment: extra.valueAsNumber || 0, monthlyPropertyTax: tax.valueAsNumber || 0, monthlyInsurance: ins.valueAsNumber || 0, monthlyHoa: hoa.valueAsNumber || 0 });
      result.replaceChildren(
        stat("Monthly payment", usd(r.monthlyTotal)), stat("Principal & interest", usd(r.monthlyPrincipalAndInterest)),
        stat("Total interest", usd(r.totalInterest)), stat("Total paid", usd(r.totalPaid)), stat("Payoff time", `${Math.floor(r.payoffMonths / 12)} y ${r.payoffMonths % 12} m`),
        ...(r.monthsSaved > 0 ? [stat("Saved by extra payments", `${r.monthsSaved} months, ${usd(r.interestSaved)}`)] : []),
      );
      const t = el("table", {}, el("thead", {}, el("tr", {}, ...["Year", "Principal paid", "Interest paid", "End balance"].map((h) => el("th", { scope: "col", text: h })))),
        el("tbody", {}, ...r.yearly.map((y) => el("tr", {}, el("td", { text: String(y.year) }), el("td", { text: usd(y.principalPaid) }), el("td", { text: usd(y.interestPaid) }), el("td", { text: usd(y.endBalance) })))));
      table.replaceChildren(el("details", {}, el("summary", { text: "Yearly amortization summary" }), t));
    } catch (e) {
      result.replaceChildren(errorBox(e));
      table.replaceChildren();
    }
  };
  for (const i of [principal, rate, years, extra, tax, ins, hoa]) i.addEventListener("input", run);
  root.append(
    el("div", { class: "grid2" },
      el("div", {}, field("Loan amount ($)", principal), field("Interest rate (% per year)", rate), field("Term (years)", years)),
      el("div", {}, field("Extra monthly payment ($)", extra), field("Property tax ($/month)", tax), field("Insurance ($/month)", ins), field("HOA ($/month)", hoa))),
    result, table,
  );
  run();
}

const widgets: Record<string, (root: HTMLElement) => void> = { qr, text: wordCounter, password, age, loan };
const root = document.getElementById("tool");
const kind = root?.dataset.tool;
if (root && kind && widgets[kind]) {
  root.replaceChildren(); // drop the no-JS fallback message
  widgets[kind](root);
}

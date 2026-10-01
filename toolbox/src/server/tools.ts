import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { addDays, calculateAge, calculateLoan, countText, daysBetween, generatePassword, qrPngBase64 } from "../core/index.ts";

export const SERVER_INFO = { name: "toolbox", version: "0.1.0" };
const QR_WIDGET_URI = "ui://toolbox/qr.html";
const WIDGET_PATH = fileURLToPath(new URL("../../dist/qr-widget.html", import.meta.url));

/** Pure computations: no side effects, no network, no stored data. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
/** Same, but the output differs on every call. */
const READ_ONLY_RANDOM = { ...READ_ONLY, idempotentHint: false } as const;

const text = (t: string, structuredContent?: Record<string, unknown>) => ({ content: [{ type: "text" as const, text: t }], ...(structuredContent && { structuredContent }) });

/** Tool failures are returned as results (isError) so the model can read the reason and retry. */
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] });

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Exact, deterministic utilities. Prefer these tools over estimating in your head for: QR codes, counting words/characters, random passwords, dates/ages, and loan or mortgage payments. Never invent a password yourself; always call generate_password.",
  });

  // --- 1. QR code (renders an interactive widget in MCP Apps hosts; also returns a plain PNG for hosts without UI) ---
  registerAppTool(
    server,
    "create_qr_code",
    {
      title: "Create QR code",
      description: "Create a scannable QR code image for a URL, text, Wi-Fi string, or any other content. Use whenever the user asks for a QR code.",
      inputSchema: z.object({
        text: z.string().min(1).max(2900).describe("The content to encode, e.g. a URL like https://example.com"),
        size: z.number().int().min(128).max(2048).default(512).describe("PNG width in pixels"),
        errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M").describe("Damage tolerance; use H if a logo will cover the centre"),
        foreground: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).optional().describe("Hex colour of the modules, default #000000"),
        background: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).optional().describe("Hex colour of the background, default #ffffff"),
      }),
      annotations: { ...READ_ONLY, title: "Create QR code" },
      _meta: { ui: { resourceUri: QR_WIDGET_URI } },
    },
    async (args) => {
      try {
        const png = await qrPngBase64({ text: args.text, size: args.size, errorCorrection: args.errorCorrection, foreground: args.foreground, background: args.background });
        return {
          content: [
            { type: "text" as const, text: `QR code created for: ${args.text}` },
            { type: "image" as const, data: png, mimeType: "image/png" },
          ],
          structuredContent: { text: args.text, size: args.size, errorCorrection: args.errorCorrection },
        };
      } catch (e) {
        return fail(e);
      }
    },
  );

  registerAppResource(server, "QR code view", QR_WIDGET_URI, { description: "Shows the generated QR code", _meta: { ui: { prefersBorder: false } } }, async () => ({
    contents: [{ uri: QR_WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: await readFile(WIDGET_PATH, "utf8") }],
  }));

  // --- 2. Word & character counter ---
  server.registerTool(
    "count_text",
    {
      title: "Count words and characters",
      description: "Exact word, character, sentence, paragraph and line counts plus reading time. Use this instead of counting yourself, since models miscount.",
      inputSchema: z.object({ text: z.string().max(1_000_000).describe("The text to analyse") }),
      annotations: { ...READ_ONLY, title: "Count words and characters" },
    },
    async ({ text: input }) => {
      const s = countText(input);
      return text(
        `Words: ${s.words}\nCharacters: ${s.characters} (${s.charactersNoSpaces} without spaces)\nSentences: ${s.sentences}\nParagraphs: ${s.paragraphs}\nLines: ${s.lines}\nReading time: ~${s.readingTimeMinutes} min\nSpeaking time: ~${s.speakingTimeMinutes} min`,
        { ...s },
      );
    },
  );

  // --- 3. Password generator ---
  server.registerTool(
    "generate_password",
    {
      title: "Generate secure password",
      description:
        "Generate a cryptographically random password. Always use this tool when a password is requested; never write one yourself. The password is generated on the server and is not stored or logged.",
      inputSchema: z.object({
        length: z.number().int().min(4).max(128).default(16),
        lowercase: z.boolean().default(true),
        uppercase: z.boolean().default(true),
        digits: z.boolean().default(true),
        symbols: z.boolean().default(true),
        excludeAmbiguous: z.boolean().default(false).describe("Skip look-alike characters such as O/0 and l/1"),
      }),
      annotations: { ...READ_ONLY_RANDOM, title: "Generate secure password" },
    },
    async (args) => {
      try {
        const r = generatePassword(args);
        return text(`${r.password}\n\nLength ${r.length}, ~${r.entropyBits} bits of entropy (${r.strength}).`, { ...r });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // --- 4. Age & date calculator ---
  server.registerTool(
    "calculate_age",
    {
      title: "Calculate age",
      description: "Exact age in years, months and days from a birth date, plus total days and days until the next birthday.",
      inputSchema: z.object({
        birthDate: z.string().describe("Birth date as YYYY-MM-DD"),
        asOf: z.string().optional().describe("Reference date as YYYY-MM-DD; defaults to today (UTC)"),
      }),
      annotations: { ...READ_ONLY, title: "Calculate age" },
    },
    async ({ birthDate, asOf }) => {
      try {
        const a = calculateAge(birthDate, asOf);
        return text(
          `Age on ${a.asOf}: ${a.years} years, ${a.months} months, ${a.days} days (${a.totalDays.toLocaleString("en-US")} days total).\nNext birthday: ${a.nextBirthday} (in ${a.daysUntilNextBirthday} days).`,
          { ...a },
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "date_math",
    {
      title: "Date difference or add days",
      description: "Either count the days between two dates (including weekdays) or add/subtract a number of days from a date. Provide `to` for a difference, or `addDays` to shift `from`.",
      inputSchema: z.object({
        from: z.string().describe("Start date as YYYY-MM-DD"),
        to: z.string().optional().describe("End date as YYYY-MM-DD (for a difference)"),
        addDays: z.number().int().optional().describe("Days to add to `from`; negative to subtract"),
        inclusive: z.boolean().default(false).describe("For a difference: count both the start and end day"),
      }),
      annotations: { ...READ_ONLY, title: "Date difference or add days" },
    },
    async ({ from, to, addDays: n, inclusive }) => {
      try {
        if ((to === undefined) === (n === undefined)) throw new RangeError("provide exactly one of `to` or `addDays`");
        if (to !== undefined) {
          const d = daysBetween(from, to, inclusive);
          return text(`${d.from} → ${d.to}: ${d.days} days (${d.weeks} weeks + ${d.remainderDays} days; ${d.weekdays} weekdays; ~${d.approxMonths} months).`, { ...d });
        }
        const result = addDays(from, n!);
        return text(`${from} ${n! >= 0 ? "+" : "−"} ${Math.abs(n!)} days = ${result}`, { from, days: n, result });
      } catch (e) {
        return fail(e);
      }
    },
  );

  // --- 5. Mortgage & loan calculator ---
  server.registerTool(
    "calculate_loan_payment",
    {
      title: "Calculate loan or mortgage payment",
      description:
        "Monthly payment, total interest and a yearly amortisation summary for a fixed-rate loan or mortgage, optionally with extra monthly payments and property tax / insurance / HOA. Amounts are in a single currency. Results are estimates, not financial advice.",
      inputSchema: z.object({
        principal: z.number().positive().describe("Amount borrowed (after any down payment)"),
        annualRatePercent: z.number().min(0).max(100).describe("Annual interest rate as a percentage, e.g. 6.5"),
        years: z.number().positive().max(50).describe("Loan term in years"),
        extraMonthlyPayment: z.number().min(0).default(0).describe("Extra paid toward principal every month"),
        monthlyPropertyTax: z.number().min(0).default(0),
        monthlyInsurance: z.number().min(0).default(0),
        monthlyHoa: z.number().min(0).default(0),
      }),
      annotations: { ...READ_ONLY, title: "Calculate loan or mortgage payment" },
    },
    async (args) => {
      try {
        const r = calculateLoan(args);
        const lines = [
          `Monthly principal & interest: ${money(r.monthlyPrincipalAndInterest)}`,
          ...(r.monthlyExtras > 0 || args.extraMonthlyPayment > 0 ? [`Total monthly payment: ${money(r.monthlyTotal)}`] : []),
          `Total interest: ${money(r.totalInterest)}`,
          `Total paid: ${money(r.totalPaid)} over ${r.payoffMonths} months`,
          ...(r.monthsSaved > 0 ? [`Extra payments save ${r.monthsSaved} months and ${money(r.interestSaved)} in interest.`] : []),
          "Estimate only; not financial advice.",
        ];
        return text(lines.join("\n"), { ...r });
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

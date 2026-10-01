import { test } from "node:test";
import assert from "node:assert/strict";
import { countText, generatePassword, calculateAge, daysBetween, addDays, parseDate, calculateLoan, qrSvg, qrPngBase64 } from "./index.ts";

test("countText: basics", () => {
  const s = countText("Hello world. This is a test!\n\nSecond paragraph here?");
  assert.equal(s.words, 9);
  assert.equal(s.sentences, 3);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.lines, 3);
  assert.equal(s.characters, 52);
  assert.equal(s.charactersNoSpaces, 43);
});

test("countText: empty, emoji, contractions", () => {
  const e = countText("");
  assert.deepEqual([e.words, e.characters, e.sentences, e.lines, e.paragraphs], [0, 0, 0, 0, 0]);
  assert.equal(countText("😀😀").characters, 2); // code points, not UTF-16 units
  assert.equal(countText("don't stop").words, 2);
  assert.equal(countText("a\r\nb").lines, 2);
});

test("countText: top words skip stop words", () => {
  const s = countText("apple banana apple the the the cherry apple banana");
  assert.deepEqual(s.topWords.slice(0, 2), [{ word: "apple", count: 3 }, { word: "banana", count: 2 }]);
});

test("generatePassword: honours options and guarantees each set", () => {
  for (let i = 0; i < 200; i++) {
    const { password } = generatePassword({ length: 8 });
    assert.equal(password.length, 8);
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[^a-zA-Z0-9]/);
  }
  assert.match(generatePassword({ length: 32, symbols: false, uppercase: false }).password, /^[a-z0-9]{32}$/);
  assert.doesNotMatch(generatePassword({ length: 128, excludeAmbiguous: true }).password, /[O0oIl1|]/);
});

test("generatePassword: validation and uniqueness", () => {
  assert.throws(() => generatePassword({ length: 3 }), RangeError);
  assert.throws(() => generatePassword({ length: 129 }), RangeError);
  assert.throws(() => generatePassword({ lowercase: false, uppercase: false, digits: false, symbols: false }), RangeError);
  assert.notEqual(generatePassword().password, generatePassword().password);
});

test("generatePassword: no obvious bias across a small alphabet", () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 4000; i++) {
    for (const c of generatePassword({ length: 10, uppercase: false, symbols: false, lowercase: false }).password) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const vals = [...counts.values()];
  assert.equal(vals.length, 10);
  const expected = 40000 / 10;
  for (const v of vals) assert.ok(Math.abs(v - expected) < expected * 0.1, `digit count ${v} too far from ${expected}`);
});

test("calculateAge: known cases", () => {
  const a = calculateAge("1990-05-15", "2025-03-10");
  assert.deepEqual([a.years, a.months, a.days], [34, 9, 23]);
  assert.equal(a.totalDays, 12_718);
  assert.equal(a.nextBirthday, "2025-05-15");
  assert.equal(a.daysUntilNextBirthday, 66);
});

test("calculateAge: birthday today, leap day, validation", () => {
  const today = calculateAge("2000-02-29", "2024-02-29");
  assert.deepEqual([today.years, today.months, today.days], [24, 0, 0]);
  assert.equal(today.nextBirthday, "2025-02-28"); // non-leap year falls back to Feb 28
  const born = calculateAge("2025-01-01", "2025-01-01");
  assert.deepEqual([born.years, born.totalDays], [0, 0]);
  assert.throws(() => calculateAge("2025-02-30", "2025-03-01"), /real calendar date/);
  assert.throws(() => calculateAge("2025-05-01", "2025-04-01"), /before the birth date/);
  assert.throws(() => parseDate("05/01/2025"), /YYYY-MM-DD/);
});

test("daysBetween / addDays", () => {
  assert.equal(daysBetween("2024-01-01", "2024-12-31").days, 365); // leap year
  assert.equal(daysBetween("2024-01-01", "2024-12-31", true).days, 366);
  assert.equal(daysBetween("2025-03-10", "2025-03-01").days, -9);
  const w = daysBetween("2025-03-03", "2025-03-10"); // Mon -> Mon
  assert.deepEqual([w.days, w.weeks, w.remainderDays, w.weekdays], [7, 1, 0, 5]);
  assert.equal(addDays("2024-02-28", 2), "2024-03-01");
  assert.equal(addDays("2025-01-01", -1), "2024-12-31");
});

test("calculateLoan: standard 30-year mortgage matches the reference payment", () => {
  const r = calculateLoan({ principal: 300_000, annualRatePercent: 6.5, years: 30 });
  assert.equal(r.monthlyPrincipalAndInterest, 1896.2); // well-known value for 300k @ 6.5% / 30y
  assert.equal(r.payoffMonths, 360);
  assert.ok(Math.abs(r.totalInterest - 382_633.07) < 5, `total interest ${r.totalInterest}`);
  assert.equal(r.yearly.length, 30);
  assert.ok(r.yearly.at(-1)!.endBalance < 0.01);
  assert.equal(r.monthsSaved, 0);
});

test("calculateLoan: 0% rate, extras, and extra payments", () => {
  const z = calculateLoan({ principal: 12_000, annualRatePercent: 0, years: 1 });
  assert.equal(z.monthlyPrincipalAndInterest, 1000);
  assert.equal(z.totalInterest, 0);

  const e = calculateLoan({ principal: 300_000, annualRatePercent: 6.5, years: 30, monthlyPropertyTax: 300, monthlyInsurance: 100, monthlyHoa: 50 });
  assert.equal(e.monthlyExtras, 450);
  assert.equal(e.monthlyTotal, 2346.2);

  const x = calculateLoan({ principal: 300_000, annualRatePercent: 6.5, years: 30, extraMonthlyPayment: 200 });
  assert.ok(x.payoffMonths < 360 && x.monthsSaved > 0 && x.interestSaved > 0);
  assert.equal(x.monthsSaved, 360 - x.payoffMonths);
});

test("calculateLoan: validation", () => {
  assert.throws(() => calculateLoan({ principal: 0, annualRatePercent: 5, years: 10 }), RangeError);
  assert.throws(() => calculateLoan({ principal: 1000, annualRatePercent: -1, years: 10 }), RangeError);
  assert.throws(() => calculateLoan({ principal: 1000, annualRatePercent: 5, years: 0 }), RangeError);
  assert.throws(() => calculateLoan({ principal: 1000, annualRatePercent: 5, years: 10, extraMonthlyPayment: -5 }), RangeError);
});

test("QR: svg and png", async () => {
  const svg = await qrSvg({ text: "https://example.com", foreground: "#112233" });
  assert.match(svg, /^<svg /);
  assert.match(svg, /#112233/);
  const png = Buffer.from(await qrPngBase64({ text: "https://example.com", size: 256 }), "base64");
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // PNG magic
  await assert.rejects(qrSvg({ text: "" }), /empty/);
  await assert.rejects(qrSvg({ text: "x".repeat(3000) }), /too long/);
  await assert.rejects(qrSvg({ text: "x", foreground: "red" }), /hex colour/);
});

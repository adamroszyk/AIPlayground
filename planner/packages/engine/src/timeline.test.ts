import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, formatClock, parseClock } from "./index.ts";

test("clock helpers", () => {
  assert.equal(parseClock("16:00"), 960);
  assert.equal(parseClock("9:05"), 545);
  assert.equal(formatClock(1500), "01:00");
  assert.throws(() => parseClock("25:00"), RangeError);
  assert.throws(() => parseClock("4pm"), RangeError);
});

test("timeline: hand-checked schedule for a 4pm ceremony", () => {
  const t = buildTimeline({ ceremonyStart: "16:00" });
  const by = Object.fromEntries(t.segments.map((s) => [s.name, `${s.start}-${s.end}`]));
  assert.equal(by["Guests arrive and are seated"], "15:30-16:00");
  assert.equal(by["Ceremony"], "16:00-16:30"); // starts exactly when asked
  assert.equal(by["Family and couple photos"], "16:40-17:25"); // 10 min buffer
  assert.equal(by["Cocktail hour"], "17:35-18:35");
  assert.equal(by["Grand entrance and dinner"], "18:45-20:00");
  assert.equal(by["Toasts"], "20:10-20:30");
  assert.equal(by["First dance"], "20:30-20:40"); // toasts flow straight into the first dance
  assert.equal(by["Cake cutting"], "20:50-21:05");
  assert.equal(by["Open dancing"], "21:15-23:15");
  assert.equal(t.endTime, "23:15");
  assert.equal(t.warnings.length, 0);
});

test("timeline: travel adds a segment; curfew and sunset warnings; midnight crossing", () => {
  const withTravel = buildTimeline({ ceremonyStart: "16:00", travelMinutes: 30 });
  assert.ok(withTravel.segments.some((s) => s.name === "Travel to reception" && s.minutes === 30));
  const late = buildTimeline({ ceremonyStart: "16:00", venueCurfew: "23:00" });
  assert.match(late.warnings.join(" "), /15 minutes after the 23:00 curfew/);
  const fine = buildTimeline({ ceremonyStart: "16:00", venueCurfew: "23:30" });
  assert.equal(fine.warnings.length, 0);
  const sun = buildTimeline({ ceremonyStart: "17:00", sunset: "17:30" });
  assert.match(sun.warnings.join(" "), /after sunset/);
  const overnight = buildTimeline({ ceremonyStart: "20:00", venueCurfew: "02:00" });
  assert.ok(overnight.segments.some((s) => s.day === 1), "later segments fall on the next day");
  assert.equal(overnight.endTime, "03:15");
  assert.match(overnight.warnings.join(" "), /75 minutes after the 02:00 curfew/, "02:00 is read as the next day");
  assert.equal(buildTimeline({ ceremonyStart: "20:00", venueCurfew: "04:00" }).warnings.length, 0);
});

test("timeline: zero-length segments are skipped and bad input is rejected", () => {
  const t = buildTimeline({ ceremonyStart: "14:00", photosMinutes: 0, cakeMinutes: 0, danceMinutes: 0 });
  assert.ok(!t.segments.some((s) => /photos|Cake|dancing/i.test(s.name)));
  assert.throws(() => buildTimeline({ ceremonyStart: "14:00", cocktailMinutes: -5 }), RangeError);
  assert.throws(() => buildTimeline({ ceremonyStart: "nope" }), RangeError);
});

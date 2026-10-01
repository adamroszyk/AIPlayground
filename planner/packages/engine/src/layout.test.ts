import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMaterials, footprint, rng, solveLayout, swingZone, verifyLayout, type Kind, type Opening, type Piece, type Placement, type Room } from "./index.ts";

const door = (wall: Opening["wall"], offset: number, width = 32, extra: Partial<Opening> = {}): Opening => ({ id: "door1", type: "door", wall, offset, width, ...extra });
const win = (wall: Opening["wall"], offset: number, width = 60): Opening => ({ id: "win1", type: "window", wall, offset, width });
const result = (rep: ReturnType<typeof verifyLayout>, id: string) => rep.results.find((r) => r.id === id);

test("footprint and swing zones", () => {
  const p: Piece = { id: "a", name: "A", w: 80, d: 30 };
  assert.deepEqual(footprint(p, { id: "a", x: 10, y: 20, rot: 0 }), { x0: 10, y0: 20, x1: 90, y1: 50 });
  assert.deepEqual(footprint(p, { id: "a", x: 10, y: 20, rot: 90 }), { x0: 10, y0: 20, x1: 40, y1: 100 });
  const room: Room = { width: 200, length: 150, openings: [door("S", 50)] };
  assert.deepEqual(swingZone(room, room.openings[0]!), { x0: 50, y0: 118, x1: 82, y1: 150 });
  assert.equal(swingZone(room, door("S", 50, 32, { swing: "out" })), null);
});

test("verifier: overlap, outside, door swing, tall piece at a window", () => {
  const room: Room = { width: 200, length: 150, openings: [door("S", 50), win("N", 80)] };
  const pieces: Piece[] = [{ id: "a", name: "A", kind: "storage", w: 40, d: 20 }, { id: "b", name: "B", kind: "storage", w: 40, d: 20, tall: true }];
  const ok: Placement[] = [{ id: "a", x: 120, y: 0, rot: 0 }, { id: "b", x: 160, y: 0, rot: 0 }];
  assert.equal(result(verifyLayout(room, pieces, ok), "no-overlap")!.ok, true);
  assert.equal(result(verifyLayout(room, pieces, [{ id: "a", x: 120, y: 0, rot: 0 }, { id: "b", x: 140, y: 5, rot: 0 }]), "no-overlap")!.ok, false);
  assert.equal(result(verifyLayout(room, pieces, [{ id: "a", x: 190, y: 0, rot: 0 }, { id: "b", x: 160, y: 0, rot: 0 }]), "inside-room")!.ok, false);
  assert.equal(result(verifyLayout(room, pieces, [{ id: "a", x: 120, y: 0, rot: 0 }, { id: "b", x: 55, y: 125, rot: 0 }]), "door-swing")!.ok, false, "furniture in the swing zone");
  assert.equal(result(verifyLayout(room, pieces, ok), "window-clear")!.ok, true);
  assert.equal(result(verifyLayout(room, pieces, [{ id: "a", x: 120, y: 0, rot: 0 }, { id: "b", x: 90, y: 0, rot: 0 }]), "window-clear")!.ok, false, "tall piece covers the window");
  assert.equal(result(verifyLayout(room, pieces, [{ id: "a", x: 120, y: 0, rot: 0 }]), "all-placed")!.ok, false, "a piece is missing");
});

test("verifier: sofa to coffee table gap", () => {
  const room: Room = { width: 200, length: 200, openings: [door("S", 150)] };
  const pieces: Piece[] = [{ id: "s", name: "Sofa", kind: "sofa", w: 80, d: 36 }, { id: "t", name: "Table", kind: "coffee_table", w: 40, d: 20 }];
  const at = (gap: number): Placement[] => [{ id: "s", x: 60, y: 20, rot: 0 }, { id: "t", x: 80, y: 20 + 36 + gap, rot: 0 }];
  assert.equal(result(verifyLayout(room, pieces, at(16)), "sofa-table-gap")!.ok, true);
  assert.equal(result(verifyLayout(room, pieces, at(6)), "sofa-table-gap")!.ok, false);
  assert.equal(result(verifyLayout(room, pieces, at(24)), "sofa-table-gap")!.ok, false);
  assert.match(result(verifyLayout(room, pieces, at(16)), "sofa-table-gap")!.detail, /16 in/);
  // no table in front of the sofa: rule is not applicable and not reported
  assert.equal(result(verifyLayout(room, pieces, [{ id: "s", x: 60, y: 20, rot: 0 }, { id: "t", x: 150, y: 20, rot: 0 }]), "sofa-table-gap"), undefined);
});

test("walkway measurement is accurate to the grid resolution", () => {
  const room: Room = { width: 240, length: 240, openings: [door("S", 104)] };
  const pieces: Piece[] = [{ id: "l", name: "Left", kind: "storage", w: 100, d: 30 }, { id: "r", name: "Right", kind: "storage", w: 100, d: 30 }];
  // two blocks across the room with a 40 in gap between them, directly in front of the door
  const placements: Placement[] = [{ id: "l", x: 0, y: 150, rot: 0 }, { id: "r", x: 140, y: 150, rot: 0 }];
  const rep = verifyLayout(room, pieces, placements);
  const m = /Narrowest point on the main route: ([\d.]+) in/.exec(result(rep, "main-walkway")!.detail);
  assert.ok(m, "reports a measured width");
  assert.ok(Math.abs(Number(m![1]) - 40) <= 4, `measured ${m![1]} in for a 40 in gap`);
  assert.equal(result(rep, "main-walkway")!.ok, true);
  // 28 in gap fails the 36 in rule
  const tight = verifyLayout(room, pieces, [{ id: "l", x: 0, y: 150, rot: 0 }, { id: "r", x: 128, y: 150, rot: 0 }]);
  assert.equal(result(tight, "main-walkway")!.ok, false);
  assert.ok(Math.abs(Number(/([\d.]+) in/.exec(result(tight, "main-walkway")!.detail)![1]) - 28) <= 4);
});

test("a wall of furniture across the door fails the walkway and seat access rules", () => {
  const room: Room = { width: 200, length: 200, openings: [door("S", 84)] };
  const pieces: Piece[] = [{ id: "wall", name: "Long shelf", kind: "storage", w: 200, d: 16 }, { id: "sofa", name: "Sofa", kind: "sofa", w: 80, d: 36 }];
  const rep = verifyLayout(room, pieces, [{ id: "wall", x: 0, y: 140, rot: 0 }, { id: "sofa", x: 60, y: 20, rot: 0 }]);
  assert.equal(result(rep, "main-walkway")!.ok, false);
  assert.equal(result(rep, "seat-access")!.ok, false);
  assert.match(result(rep, "seat-access")!.detail, /Sofa/);
});

test("dining and storage clearances", () => {
  const room: Room = { width: 200, length: 200, openings: [door("S", 160)] };
  const pieces: Piece[] = [{ id: "d", name: "Dining table", kind: "dining_table", w: 72, d: 36 }];
  assert.equal(result(verifyLayout(room, pieces, [{ id: "d", x: 64, y: 82, rot: 0 }]), "dining-clearance")!.ok, true);
  assert.equal(result(verifyLayout(room, pieces, [{ id: "d", x: 20, y: 82, rot: 0 }]), "dining-clearance")!.ok, false, "20 in to the wall");
  const stor: Piece[] = [{ id: "s", name: "Dresser", kind: "storage", w: 60, d: 18 }, { id: "x", name: "Chest", kind: "storage", w: 40, d: 20 }];
  assert.equal(result(verifyLayout(room, stor, [{ id: "s", x: 0, y: 0, rot: 0 }, { id: "x", x: 120, y: 120, rot: 0 }]), "storage-front")!.ok, true);
  assert.equal(result(verifyLayout(room, stor, [{ id: "s", x: 0, y: 0, rot: 0 }, { id: "x", x: 10, y: 30, rot: 0 }]), "storage-front")!.ok, false);
});

test("solver: classic rooms are solved and independently re-verified", () => {
  const cases: { room: Room; pieces: Piece[] }[] = [
    { room: { width: 168, length: 144, openings: [door("S", 96), win("N", 54)] }, pieces: [{ id: "sofa", name: "Sofa", kind: "sofa", w: 84, d: 36 }, { id: "table", name: "Coffee table", kind: "coffee_table", w: 40, d: 20 }, { id: "chair", name: "Armchair", kind: "chair", w: 32, d: 32 }, { id: "tv", name: "TV unit", kind: "tv", w: 60, d: 16 }, { id: "side", name: "Side table", kind: "side_table", w: 18, d: 18 }] },
    { room: { width: 108, length: 96, openings: [door("S", 40), win("N", 20)] }, pieces: [{ id: "sofa", name: "Sofa", kind: "sofa", w: 90, d: 38 }, { id: "table", name: "Coffee table", kind: "coffee_table", w: 42, d: 24 }, { id: "tv", name: "TV unit", kind: "tv", w: 55, d: 16 }] },
    { room: { width: 168, length: 144, openings: [door("W", 100, 32), win("N", 50)] }, pieces: [{ id: "bed", name: "Bed", kind: "bed", w: 60, d: 80 }, { id: "n1", name: "Nightstand", kind: "nightstand", w: 20, d: 16 }, { id: "n2", name: "Nightstand", kind: "nightstand", w: 20, d: 16 }, { id: "dr", name: "Dresser", kind: "storage", w: 60, d: 18 }] },
    { room: { width: 180, length: 156, openings: [door("S", 20), win("N", 50)] }, pieces: [{ id: "dt", name: "Dining table", kind: "dining_table", w: 60, d: 36 }] },
  ];
  for (const [i, c] of cases.entries()) {
    const res = solveLayout(c.room, c.pieces, { seed: 3 });
    assert.equal(res.status, "solved", `case ${i}: ${res.report.results.filter((r) => !r.ok).map((r) => r.detail).join(" | ")}`);
    assert.equal(verifyLayout(c.room, c.pieces, res.placements).ok, true);
    // brute-force overlap check written separately from the verifier
    for (let a = 0; a < res.placements.length; a++) for (let b = a + 1; b < res.placements.length; b++) {
      const A = footprint(c.pieces.find((p) => p.id === res.placements[a]!.id)!, res.placements[a]!), B = footprint(c.pieces.find((p) => p.id === res.placements[b]!.id)!, res.placements[b]!);
      assert.ok(A.x1 <= B.x0 + 1e-6 || B.x1 <= A.x0 + 1e-6 || A.y1 <= B.y0 + 1e-6 || B.y1 <= A.y0 + 1e-6, `case ${i}: overlap`);
    }
  }
});

test("solver: an impossible room is reported as partial with the failing rule named", () => {
  const room: Room = { width: 156, length: 132, openings: [door("S", 20), win("N", 50)] };
  const pieces: Piece[] = [{ id: "dt", name: "Dining table", kind: "dining_table", w: 72, d: 36 }, { id: "sb", name: "Sideboard", kind: "storage", w: 60, d: 18 }];
  const res = solveLayout(room, pieces, { seed: 3 });
  assert.equal(res.status, "partial");
  assert.equal(res.report.ok, false);
  assert.ok(res.report.results.some((r) => !r.ok && /Dining|Storage/.test(r.description)));
  const tooBig = solveLayout({ width: 60, length: 60, openings: [door("S", 10)] }, [{ id: "s", name: "Sofa", kind: "sofa", w: 90, d: 36 }], { seed: 1 });
  assert.deepEqual(tooBig.unplaced, ["s"]);
  assert.equal(tooBig.status, "partial");
});

test("solver: deterministic for a seed; random rooms never return a 'solved' that fails verification", () => {
  const kinds: [Kind, number, number][] = [["sofa", 84, 36], ["chair", 32, 32], ["coffee_table", 40, 20], ["tv", 56, 16], ["storage", 48, 18], ["side_table", 18, 18], ["desk", 48, 24]];
  let solved = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed * 31);
    const room: Room = { width: 120 + Math.floor(r() * 120), length: 120 + Math.floor(r() * 100), openings: [door((["N", "S", "E", "W"] as const)[Math.floor(r() * 4)]!, 20 + Math.floor(r() * 60)), win("N", 40, 48)] };
    const n = 3 + Math.floor(r() * 4);
    const pieces: Piece[] = Array.from({ length: n }, (_, i) => { const [k, w, d] = kinds[Math.floor(r() * kinds.length)]!; return { id: `p${i}`, name: `${k}${i}`, kind: k, w, d }; });
    const a = solveLayout(room, pieces, { seed }), b = solveLayout(room, pieces, { seed });
    assert.deepEqual(a.placements, b.placements, `seed ${seed} not deterministic`);
    assert.equal(a.status === "solved", a.report.ok && a.unplaced.length === 0);
    if (a.status === "solved") { solved++; assert.equal(verifyLayout(room, pieces, a.placements).ok, true); }
  }
  assert.ok(solved >= 20, `only ${solved} of 40 random rooms solved`);
});

test("materials: matches hand calculation", () => {
  // 14 x 12 ft, 8 ft walls, one 32x80 door and one 60x48 window
  const room: Room = { width: 168, length: 144, openings: [door("S", 96), win("N", 54)] };
  const m = estimateMaterials({ room, paint: { pricePerGallon: 40 }, flooring: { pricePerSqFt: 3 }, baseboard: { pricePerFoot: 1.5 } });
  assert.equal(m.floorAreaSqFt, 168);
  assert.equal(m.flooringSqFtWithWaste, 184.8);
  assert.equal(m.wallAreaSqFt, 378.2); // 416 - 17.78 - 20
  assert.equal(m.paintGallons, 2.16); // 378.2 * 2 / 350
  assert.equal(m.paintGallonsToBuy, 3);
  assert.equal(m.baseboardFeet, 49.3); // (624 - 32) / 12
  assert.equal(m.baseboardFeetWithWaste, 54.3);
  assert.equal(m.costs.flooring, 554.4);
  assert.equal(m.costs.paint, 120);
  assert.equal(m.costs.baseboard, 81.4); // 54.2667 * 1.5
  assert.equal(m.costs.total, 755.8);
  const c = estimateMaterials({ room, paint: { ceiling: true, coats: 1 } });
  assert.equal(c.ceilingAreaSqFt, 168);
  assert.equal(c.paintGallons, 1.56); // (378.2 + 168) / 350
  assert.throws(() => estimateMaterials({ room: { ...room, width: 0 } }), RangeError);
  assert.throws(() => estimateMaterials({ room, flooring: { wastePercent: 120 } }), RangeError);
  assert.equal(estimateMaterials({ room }).costs.total, undefined);
});

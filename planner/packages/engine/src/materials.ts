import type { Room } from "./layout.ts";

export interface MaterialsInput {
  room: Room;
  /** Ceiling height in inches. Default 96. */
  wallHeight?: number;
  paint?: { coats?: number; coveragePerGallonSqFt?: number; ceiling?: boolean; pricePerGallon?: number };
  flooring?: { wastePercent?: number; pricePerSqFt?: number };
  baseboard?: { wastePercent?: number; pricePerFoot?: number };
}
export interface MaterialsResult {
  floorAreaSqFt: number;
  flooringSqFtWithWaste: number;
  wallAreaSqFt: number;
  ceilingAreaSqFt: number;
  paintGallons: number;
  paintGallonsToBuy: number;
  baseboardFeet: number;
  baseboardFeetWithWaste: number;
  costs: { flooring?: number; paint?: number; baseboard?: number; total?: number };
  assumptions: string[];
}

const SQIN_PER_SQFT = 144;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

function positive(name: string, v: number) {
  if (!(v > 0) || !Number.isFinite(v)) throw new RangeError(`${name} must be a positive number`);
}

export function estimateMaterials(input: MaterialsInput): MaterialsResult {
  const { room } = input;
  positive("room width", room.width);
  positive("room length", room.length);
  const height = input.wallHeight ?? 96;
  positive("wall height", height);
  const coats = input.paint?.coats ?? 2;
  const coverage = input.paint?.coveragePerGallonSqFt ?? 350;
  const floorWaste = input.flooring?.wastePercent ?? 10;
  const baseWaste = input.baseboard?.wastePercent ?? 10;
  positive("coats", coats);
  positive("paint coverage", coverage);
  for (const [n, v] of [["flooring waste", floorWaste], ["baseboard waste", baseWaste]] as const) if (!(v >= 0 && v <= 100)) throw new RangeError(`${n} percent must be between 0 and 100`);

  const perimeter = 2 * (room.width + room.length);
  const openingArea = room.openings.reduce((s, o) => s + o.width * (o.height ?? (o.type === "door" ? 80 : 48)), 0);
  const wallSqIn = Math.max(0, perimeter * height - openingArea);
  const wallSqFt = wallSqIn / SQIN_PER_SQFT;
  const floorSqFt = (room.width * room.length) / SQIN_PER_SQFT;
  const ceilingSqFt = input.paint?.ceiling ? floorSqFt : 0;
  const paintSqFt = (wallSqFt + ceilingSqFt) * coats;
  const gallons = paintSqFt / coverage;
  const doorWidths = room.openings.filter((o) => o.type === "door").reduce((s, o) => s + o.width, 0);
  const baseFeet = Math.max(0, perimeter - doorWidths) / 12;

  const flooringWithWaste = floorSqFt * (1 + floorWaste / 100);
  const baseWithWaste = baseFeet * (1 + baseWaste / 100);
  const gallonsToBuy = Math.ceil(gallons - 1e-9);

  const costs: MaterialsResult["costs"] = {};
  if (input.flooring?.pricePerSqFt !== undefined) costs.flooring = r2(flooringWithWaste * input.flooring.pricePerSqFt);
  if (input.paint?.pricePerGallon !== undefined) costs.paint = r2(gallonsToBuy * input.paint.pricePerGallon);
  if (input.baseboard?.pricePerFoot !== undefined) costs.baseboard = r2(baseWithWaste * input.baseboard.pricePerFoot);
  const parts = Object.values(costs).filter((v): v is number => v !== undefined);
  if (parts.length) costs.total = r2(parts.reduce((a, b) => a + b, 0));

  return {
    floorAreaSqFt: r1(floorSqFt),
    flooringSqFtWithWaste: r1(flooringWithWaste),
    wallAreaSqFt: r1(wallSqFt),
    ceilingAreaSqFt: r1(ceilingSqFt),
    paintGallons: r2(gallons),
    paintGallonsToBuy: gallonsToBuy,
    baseboardFeet: r1(baseFeet),
    baseboardFeetWithWaste: r1(baseWithWaste),
    costs,
    assumptions: [
      `Walls ${height} in high; doors default to 80 in tall and windows to 48 in tall unless given`,
      `${coats} coat${coats === 1 ? "" : "s"} of paint at ${coverage} sq ft per gallon${input.paint?.ceiling ? ", ceiling included" : ", ceiling not included"}`,
      `${floorWaste}% flooring waste and ${baseWaste}% baseboard waste`,
      "Estimates only: check your supplier's coverage and pack sizes before buying",
    ],
  };
}

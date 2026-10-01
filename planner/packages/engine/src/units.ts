export const UNIT_TO_INCHES = { in: 1, ft: 12, cm: 1 / 2.54, m: 100 / 2.54 } as const;
export type Unit = keyof typeof UNIT_TO_INCHES;
export const toInches = (n: number, unit: Unit) => Math.round(n * UNIT_TO_INCHES[unit] * 100) / 100;
export const fromInches = (n: number, unit: Unit) => Math.round((n / UNIT_TO_INCHES[unit]) * 100) / 100;

/** Common furniture sizes in inches (width = side to side, depth = front to back). */
export const FURNITURE_PRESETS: { name: string; kind: string; w: number; d: number; tall?: boolean }[] = [
  { name: "Sofa", kind: "sofa", w: 84, d: 36 },
  { name: "Loveseat", kind: "sofa", w: 60, d: 34 },
  { name: "Armchair", kind: "chair", w: 32, d: 32 },
  { name: "Coffee table", kind: "coffee_table", w: 48, d: 24 },
  { name: "Side table", kind: "side_table", w: 18, d: 18 },
  { name: "TV unit", kind: "tv", w: 60, d: 16 },
  { name: "Queen bed", kind: "bed", w: 60, d: 80 },
  { name: "Double bed", kind: "bed", w: 54, d: 75 },
  { name: "Nightstand", kind: "nightstand", w: 20, d: 16 },
  { name: "Dresser", kind: "storage", w: 60, d: 18 },
  { name: "Desk", kind: "desk", w: 48, d: 24 },
  { name: "Dining table (6 seats)", kind: "dining_table", w: 72, d: 36 },
  { name: "Bookcase", kind: "storage", w: 36, d: 14, tall: true },
];

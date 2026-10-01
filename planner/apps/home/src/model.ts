import { footprint, type Kind, type LayoutReport, type Opening, type Piece, type Placement, type Room, type Rot } from "@planner/engine";
import { FACING, fromInches, toInches, type Unit } from "@planner/core";

export const KINDS = ["sofa", "chair", "coffee_table", "side_table", "tv", "bed", "nightstand", "desk", "dining_table", "storage", "generic"] as const;
export const WALLS = ["north", "east", "south", "west"] as const;
export type WallName = (typeof WALLS)[number];
const WALL_CODE = { north: "N", east: "E", south: "S", west: "W" } as const;
const CODE_WALL = { N: "north", E: "east", S: "south", W: "west" } as const;
const FACING_ROT: Record<WallName, Rot> = { south: 0, west: 90, north: 180, east: 270 };

export interface OpeningInput { wall: WallName; offset: number; width: number; height?: number; swing?: "in" | "out" }
export interface RoomInput { width: number; length: number; doors?: OpeningInput[]; windows?: OpeningInput[] }
export interface FurnitureInput { name: string; kind?: Kind; width: number; depth: number; tall?: boolean }
export interface PlacedFurnitureInput extends FurnitureInput { x: number; y: number; facing: WallName }

/** What gets stored with a plan and drawn by the widget and the web editor. All lengths in inches. */
export interface RoomPlan {
  v: 1;
  unit: Unit;
  room: Room;
  pieces: Piece[];
  placements: Placement[];
  report: LayoutReport;
  status: "solved" | "partial";
  unplaced: string[];
}

const err = (m: string): never => { throw new RangeError(m); };

export function buildRoom(input: RoomInput, unit: Unit): Room {
  const width = toInches(input.width, unit), length = toInches(input.length, unit);
  if (width < 36 || width > 720 || length < 36 || length > 720) err(`The room must be between 3 ft and 60 ft on each side (got ${fromInches(width, unit)} × ${fromInches(length, unit)} ${unit}).`);
  const openings: Opening[] = [];
  const add = (list: OpeningInput[] | undefined, type: "door" | "window") => {
    (list ?? []).forEach((o, i) => {
      const w = toInches(o.width, unit), offset = toInches(o.offset, unit);
      const wallLen = o.wall === "north" || o.wall === "south" ? width : length;
      if (w < 12 || w > 120) err(`A ${type} must be between 12 in and 10 ft wide (the ${o.wall} ${type} is ${fromInches(w, unit)} ${unit}).`);
      if (offset < 0 || offset + w > wallLen + 0.01) err(`The ${o.wall} ${type} does not fit on a ${fromInches(wallLen, unit)} ${unit} wall (it starts ${fromInches(offset, unit)} ${unit} from the corner and is ${fromInches(w, unit)} ${unit} wide).`);
      openings.push({ id: `${type}${i + 1}`, type, wall: WALL_CODE[o.wall], offset, width: w, ...(o.height ? { height: toInches(o.height, unit) } : {}), ...(type === "door" ? { swing: o.swing ?? "in" } : {}) });
    });
  };
  add(input.doors, "door");
  add(input.windows, "window");
  if ((input.doors ?? []).length > 4 || (input.windows ?? []).length > 8) err("Too many doors or windows (up to 4 doors and 8 windows).");
  return { width, length, openings };
}

export function buildPieces(list: FurnitureInput[], unit: Unit, room: Room): Piece[] {
  if (list.length === 0) err("Add at least one piece of furniture.");
  if (list.length > 25) err("Up to 25 pieces of furniture at a time.");
  return list.map((f, i) => {
    const w = toInches(f.width, unit), d = toInches(f.depth, unit);
    if (w < 6 || d < 6 || w > 240 || d > 240) err(`${f.name}: sizes must be between 6 in and 20 ft (got ${fromInches(w, unit)} × ${fromInches(d, unit)} ${unit}).`);
    if (Math.min(w, d) > Math.max(room.width, room.length) || Math.max(w, d) > Math.max(room.width, room.length)) err(`${f.name} (${fromInches(Math.max(w, d), unit)} ${unit}) is longer than the room's longest wall.`);
    return { id: `p${i + 1}`, name: f.name.trim(), kind: f.kind ?? "generic", w, d, ...(f.tall ? { tall: true } : {}) };
  });
}

export function buildPlacements(list: PlacedFurnitureInput[], pieces: Piece[], unit: Unit): Placement[] {
  return list.map((f, i) => ({ id: pieces[i]!.id, x: toInches(f.x, unit), y: toInches(f.y, unit), rot: FACING_ROT[f.facing] }));
}

export function describePlacement(piece: Piece, pl: Placement, room: Room, unit: Unit): string {
  const b = footprint(piece, pl);
  const near: string[] = [];
  if (b.y0 <= 1) near.push("north wall");
  if (b.y1 >= room.length - 1) near.push("south wall");
  if (b.x0 <= 1) near.push("west wall");
  if (b.x1 >= room.width - 1) near.push("east wall");
  const at = `${fromInches(b.x0, unit)} ${unit} from the west wall and ${fromInches(b.y0, unit)} ${unit} from the north wall`;
  return `${piece.name}: ${near.length ? `against the ${near.join(" and ")}, ` : ""}facing ${FACING[pl.rot]}; its north-west corner is ${at}`;
}

export function toStructured(plan: RoomPlan) {
  return {
    status: plan.status,
    unit: plan.unit,
    room: plan.room,
    pieces: plan.pieces,
    placements: plan.placements,
    report: plan.report,
    unplaced: plan.unplaced,
  };
}

/** Throws RangeError with a user-readable message when stored or submitted plan data is not valid. */
export function validateRoomPlan(data: unknown): void {
  const d = data as Partial<RoomPlan> | null;
  if (!d || typeof d !== "object") err("Plan data must be an object");
  const p = d as Partial<RoomPlan>;
  if (p.v !== 1 || !p.room || !Array.isArray(p.pieces) || !Array.isArray(p.placements)) err("This is not a valid room plan");
  const room = p.room as Room;
  if (!(room.width >= 36 && room.width <= 720 && room.length >= 36 && room.length <= 720)) err("Room size is out of range");
  if (!Array.isArray(room.openings) || room.openings.length > 16) err("Too many doors or windows");
  if (p.pieces!.length > 25 || p.placements!.length > 25) err("Too many pieces");
  for (const pc of p.pieces!) {
    if (typeof pc.id !== "string" || typeof pc.name !== "string" || pc.name.length > 80) err("Invalid piece");
    if (!(pc.w >= 6 && pc.w <= 240 && pc.d >= 6 && pc.d <= 240)) err("Piece size is out of range");
  }
  for (const pl of p.placements!) {
    if (![0, 90, 180, 270].includes(pl.rot) || !Number.isFinite(pl.x) || !Number.isFinite(pl.y)) err("Invalid placement");
  }
}

export { CODE_WALL };

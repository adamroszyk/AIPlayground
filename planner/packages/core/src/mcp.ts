/** Shared helpers for tool definitions. Kept free of MCP SDK imports so it is cheap to test. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
/** Creates a saved plan (a write), never deletes or overwrites anything. */
export const CREATES_PLAN = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

export const fail = (message: string) => ({ isError: true as const, content: [{ type: "text" as const, text: message }] });

export { UNIT_TO_INCHES, toInches, fromInches, type Unit } from "@planner/engine";

export const FACING: Record<number, string> = { 0: "south", 90: "west", 180: "north", 270: "east" };

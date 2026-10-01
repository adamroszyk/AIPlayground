/** Shared helpers for tool definitions. Kept free of MCP SDK imports so it is cheap to test. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
/** Creates a saved plan (a write), never deletes or overwrites anything. */
export const CREATES_PLAN = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

export const fail = (message: string) => ({ isError: true as const, content: [{ type: "text" as const, text: message }] });

export const UNIT_TO_INCHES = { in: 1, ft: 12, cm: 1 / 2.54, m: 100 / 2.54 } as const;
export type Unit = keyof typeof UNIT_TO_INCHES;
export const toInches = (n: number, unit: Unit) => Math.round(n * UNIT_TO_INCHES[unit] * 100) / 100;
export const fromInches = (n: number, unit: Unit) => Math.round((n / UNIT_TO_INCHES[unit]) * 100) / 100;

export const FACING: Record<number, string> = { 0: "south", 90: "west", 180: "north", 270: "east" };

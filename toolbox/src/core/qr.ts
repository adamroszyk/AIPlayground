import QRCode from "qrcode";

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export interface QrOptions {
  text: string;
  /** Pixel width of the PNG; SVG scales freely. */
  size?: number;
  errorCorrection?: QrErrorCorrection;
  foreground?: string;
  background?: string;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// A QR code stores at most 2,953 bytes at level L. Keep a clear limit instead of an obscure library error.
const MAX_BYTES = 2900;

function validate(o: QrOptions) {
  if (!o.text) throw new RangeError("text must not be empty");
  if (new TextEncoder().encode(o.text).length > MAX_BYTES) throw new RangeError(`text is too long for a QR code (max ~${MAX_BYTES} bytes)`);
  for (const [k, v] of [["foreground", o.foreground], ["background", o.background]] as const) {
    if (v !== undefined && !HEX.test(v)) throw new RangeError(`${k} must be a hex colour like #000000`);
  }
}

const colours = (o: QrOptions) => ({ dark: o.foreground ?? "#000000", light: o.background ?? "#ffffff" });

export async function qrSvg(o: QrOptions): Promise<string> {
  validate(o);
  return QRCode.toString(o.text, { type: "svg", errorCorrectionLevel: o.errorCorrection ?? "M", margin: 2, color: colours(o) });
}

/** Returns base64 (no data: prefix). Node-only (uses node-canvas-free PNG encoder in the `qrcode` server build). */
export async function qrPngBase64(o: QrOptions): Promise<string> {
  validate(o);
  const buf = await QRCode.toBuffer(o.text, { type: "png", errorCorrectionLevel: o.errorCorrection ?? "M", margin: 2, width: o.size ?? 512, color: colours(o) });
  return buf.toString("base64");
}

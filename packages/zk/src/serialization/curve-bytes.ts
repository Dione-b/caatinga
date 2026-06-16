import type { SerializedG1, SerializedG2 } from "./serialize-proof.js";

export function concatG1Bytes(point: SerializedG1): Uint8Array {
  const bytes = new Uint8Array(point.x.length + point.y.length);
  bytes.set(point.x, 0);
  bytes.set(point.y, point.x.length);
  return bytes;
}

export function concatG2Bytes(point: SerializedG2): Uint8Array {
  const bytes = new Uint8Array(
    point.x[0].length + point.x[1].length + point.y[0].length + point.y[1].length
  );
  let offset = 0;
  for (const chunk of [point.x[0], point.x[1], point.y[0], point.y[1]]) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function concatG1Hex(point: SerializedG1): string {
  return bytesToHex(concatG1Bytes(point));
}

export function concatG2Hex(point: SerializedG2): string {
  return bytesToHex(concatG2Bytes(point));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

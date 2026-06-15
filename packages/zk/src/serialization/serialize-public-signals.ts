import { decimalToLe32 } from "./bigint-helpers.js";

export function serializePublicSignals(signals: string[]): Uint8Array[] {
  return signals.map((s) => decimalToLe32(s));
}

/**
 * Convert a decimal string to a little-endian unsigned 32-byte array.
 */
export function decimalToLe32(decimal: string): Uint8Array {
  let value = BigInt(decimal);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
}

/**
 * Convert a decimal string to a big-endian unsigned 48-byte array.
 */
export function decimalToBe48(decimal: string): Uint8Array {
  let value = BigInt(decimal);
  const out = new Uint8Array(48);
  for (let i = 47; i >= 0; i--) {
    out[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return out;
}

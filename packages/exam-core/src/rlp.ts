// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Just enough RLP to read an Ethereum block header's timestamp (field 12 of
 * the header list) from a bitgraph-anchor-witness/1 file, offline. The
 * header's keccak-256 is checked against the anchor's block hash by the
 * caller; a timestamp read from a header that does not hash is no time.
 */
import { keccak_256 } from "@noble/hashes/sha3";

export function hexToBytes(hex: string): Uint8Array | null {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) return null;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export const bytesToHex0x = (b: Uint8Array): string => "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

type Item = Uint8Array | Item[];

function decodeAt(b: Uint8Array, i: number): [Item, number] {
  if (i >= b.length) throw new Error("RLP: truncated");
  const p = b[i]!;
  const len = (start: number, n: number): number => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + b[start + k]!; return v; };
  if (p < 0x80) return [b.subarray(i, i + 1), i + 1];
  if (p < 0xb8) { const n = p - 0x80; return [b.subarray(i + 1, i + 1 + n), i + 1 + n]; }
  if (p < 0xc0) { const l = p - 0xb7; const n = len(i + 1, l); return [b.subarray(i + 1 + l, i + 1 + l + n), i + 1 + l + n]; }
  let n: number;
  let start: number;
  if (p < 0xf8) { n = p - 0xc0; start = i + 1; } else { const l = p - 0xf7; n = len(i + 1, l); start = i + 1 + l; }
  const items: Item[] = [];
  let j = start;
  while (j < start + n) { const [v, e] = decodeAt(b, j); items.push(v); j = e; }
  if (j !== start + n) throw new Error("RLP: list length mismatch");
  return [items, j];
}

/** Unix seconds from the header, or null when the bytes are not a header list with a numeric 12th field. */
export function blockTimeFromHeader(headerRlpHex: string): number | null {
  const bytes = hexToBytes(headerRlpHex);
  if (bytes === null) return null;
  try {
    const [outer, end] = decodeAt(bytes, 0);
    if (end !== bytes.length || !Array.isArray(outer) || outer.length < 12) return null;
    const ts = outer[11];
    if (!(ts instanceof Uint8Array) || ts.length > 8) return null;
    let v = 0;
    for (const x of ts) v = v * 256 + x;
    return v;
  } catch {
    return null;
  }
}

/** keccak-256 of the header bytes as 0x-hex, or null when the hex is malformed. */
export function headerHash(headerRlpHex: string): string | null {
  const bytes = hexToBytes(headerRlpHex);
  return bytes === null ? null : bytesToHex0x(keccak_256(bytes));
}

/** "12 Sep 2026 07:07:23Z", the way every floor is printed. */
export function formatUtc(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}Z`;
}

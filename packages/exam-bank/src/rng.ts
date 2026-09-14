// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * The only randomness a generator may touch. The bank never seeds one: the
 * exam core instantiates an HMAC-DRBG from the slot commitment and the bank
 * digest and hands it in. Nothing here reads a clock, the platform random source, or the
 * iteration order of a Map or Set (a test greps for the usual offenders). A test in exam-core generates a thousand
 * papers twice and diffs them.
 */
export interface Rng {
  /** The next 32-bit unsigned integer from the stream. */
  u32(): number;
}

const TWO_32 = 0x1_0000_0000;

/**
 * Uniform integer in [0, n). Rejection sampling on u32 so no value is
 * favoured; the loop is deterministic given the stream.
 */
export function int(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > TWO_32) throw new RangeError(`int: n must be an integer in [1, 2^32], got ${n}`);
  const limit = TWO_32 - (TWO_32 % n);
  for (;;) {
    const x = rng.u32();
    if (x < limit) return x % n;
  }
}

/** Uniform integer in [lo, hi], inclusive. */
export function between(rng: Rng, lo: number, hi: number): number {
  if (hi < lo) throw new RangeError(`between: hi < lo (${lo}, ${hi})`);
  return lo + int(rng, hi - lo + 1);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError("pick: empty");
  return items[int(rng, items.length)] as T;
}

/** Fisher–Yates over a copy. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    const t = out[i] as T;
    out[i] = out[j] as T;
    out[j] = t;
  }
  return out;
}

/** A decimal integer with exactly `digits` digits (first digit 1–9), as a BigInt. */
export function bigDigits(rng: Rng, digits: number): bigint {
  let s = String(between(rng, 1, 9));
  for (let i = 1; i < digits; i++) s += String(int(rng, 10));
  return BigInt(s);
}

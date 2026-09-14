// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * seed = SHA-256( "exam/1" || 0x00 || commitment || 0x00 || bankDigest )
 *
 * The commitment is the slot's (bitgraph-fuse/1, 32 bytes); the bank digest
 * is exam-bank/1's bankDigestB64 decoded (32 bytes). One seed, one paper.
 */
import { sha256 } from "@noble/hashes/sha256";
import type { Rng } from "@mikeargento/exam-bank";
import { HmacDrbg } from "./drbg.js";

export const EXAM_DOMAIN = "exam/1";

export function deriveSeed(commitment: Uint8Array, bankDigest: Uint8Array): Uint8Array {
  if (commitment.length !== 32) throw new TypeError("commitment must be 32 bytes");
  if (bankDigest.length !== 32) throw new TypeError("bankDigest must be 32 bytes");
  const label = new TextEncoder().encode(EXAM_DOMAIN);
  const pre = new Uint8Array(label.length + 1 + 32 + 1 + 32);
  pre.set(label, 0);
  pre[label.length] = 0x00;
  pre.set(commitment, label.length + 1);
  pre[label.length + 1 + 32] = 0x00;
  pre.set(bankDigest, label.length + 2 + 32);
  return sha256(pre);
}

/**
 * The bank's Rng over the DRBG: every u32 is ONE Generate call of four bytes,
 * read big-endian. Simple to restate in any language, and the draw count is
 * visible in reseedCounter.
 */
export class DrbgRng implements Rng {
  readonly drbg: HmacDrbg;
  constructor(seed: Uint8Array) {
    this.drbg = new HmacDrbg(seed);
  }
  u32(): number {
    const b = this.drbg.generate(4);
    return ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
  }
}

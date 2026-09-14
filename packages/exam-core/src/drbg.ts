// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * HMAC_DRBG with SHA-256, NIST SP 800-90A Rev. 1 section 10.1.2, vendored so
 * its output can never move under a dependency bump. Instantiated from one
 * 32-byte seed as the entropy input, with no nonce and no personalization
 * string; no additional input on Generate; never reseeded. SPEC.md carries
 * the test vectors, checked against an independent implementation.
 */
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

const OUTLEN = 32;

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export class HmacDrbg {
  private key: Uint8Array;
  private v: Uint8Array;
  /** Generate calls so far; reported, never acted on (the exam never reseeds). */
  reseedCounter = 1;

  /** 10.1.2.3 Instantiate: seed_material = entropy_input (|| nonce || personalization, both empty here). */
  constructor(seedMaterial: Uint8Array) {
    this.key = new Uint8Array(OUTLEN);
    this.v = new Uint8Array(OUTLEN).fill(0x01);
    this.update(seedMaterial);
  }

  /** 10.1.2.2 Update. */
  private update(providedData?: Uint8Array): void {
    this.key = hmac(sha256, this.key, concat(this.v, Uint8Array.of(0x00), providedData ?? new Uint8Array(0)));
    this.v = hmac(sha256, this.key, this.v);
    if (providedData === undefined || providedData.length === 0) return;
    this.key = hmac(sha256, this.key, concat(this.v, Uint8Array.of(0x01), providedData));
    this.v = hmac(sha256, this.key, this.v);
  }

  /** 10.1.2.5 Generate, with no additional input: the leftmost n bytes of successive V values, then Update. */
  generate(n: number): Uint8Array {
    if (!Number.isInteger(n) || n < 0) throw new RangeError("generate: n must be a non-negative integer");
    const out = new Uint8Array(n);
    let at = 0;
    while (at < n) {
      this.v = hmac(sha256, this.key, this.v);
      const take = Math.min(OUTLEN, n - at);
      out.set(this.v.subarray(0, take), at);
      at += take;
    }
    this.update();
    this.reseedCounter++;
    return out;
  }
}

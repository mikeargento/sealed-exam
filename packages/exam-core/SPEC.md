# The sealed exam: derivation spec (`exam/1`, bank `exam-bank/1`)

Everything a verifier needs to re-derive a paper from a proof, in any language. Nothing here
depends on a library whose output could move.

## 1. Inputs

- **commitment** (32 bytes): the BitGraph slot commitment of the paper's proof, recomputed from the
  proof's own slot record exactly as `@mikeargento/bitgraph-verify` does:
  `SHA-256("bitgraph-fuse/1" || 0x00 || slotRecordHash || nonce)`, where `slotRecordHash` is
  SHA-256 of the canonical JSON of the slot record without `signatureB64` and `nonce` is the
  record's `nonceB64` decoded. The same 32 bytes are the last 32 of the fused paper's 48-byte trailer.
- **bankDigest** (32 bytes): `bank.json`'s `bankDigestB64` decoded. Recomputed as
  SHA-256 of the canonical JSON of `bank.json` with the `bankDigestB64` member removed, where
  `generatorTarDigestB64` inside it is SHA-256 of the generator source archive (section 5).

Canonical JSON everywhere: object keys sorted lexicographically at every level, no whitespace,
UTF-8, `undefined` members dropped (the verify package's `canonicalize`).

## 2. Seed

```
seed = SHA-256( "exam/1" || 0x00 || commitment || 0x00 || bankDigest )
```
(`"exam/1"` is six ASCII bytes; 32 + 1 + 32 + 1 + 32 = 72 bytes of preimage after the label.)

## 3. DRBG

HMAC_DRBG with SHA-256, NIST SP 800-90A Rev. 1 section 10.1.2, `outlen` = 32:

- **Instantiate** with `seed_material = seed` (entropy input; no nonce, no personalization string):
  `Key = 0x00 × 32`, `V = 0x01 × 32`, then `Update(seed_material)`.
- **Update(data)**: `Key = HMAC(Key, V || 0x00 || data)`; `V = HMAC(Key, V)`; if `data` is
  non-empty: `Key = HMAC(Key, V || 0x01 || data)`; `V = HMAC(Key, V)`.
- **Generate(n)**, no additional input: `temp = ""`; while `len(temp) < n`: `V = HMAC(Key, V)`;
  `temp = temp || V`; return the leftmost `n` bytes of `temp`; then `Update()` with empty data.
- Never reseeded. The exam draws far fewer than 2^48 times.

Vectors (seed = `000102…1e1f`, the 32 bytes 0x00 through 0x1f), three successive Generate calls,
checked against an independent implementation (npm `hmac-drbg` 1.0.1):

```
Generate(32) = 3226437dd9f98b17591aad731383303213439f64d029a5764e84e36256ddeb79
Generate(4)  = 68ddf0df
Generate(48) = 8a3ac94197d7576989f911850eadca78d9f2542fbfd6d73f340260e38435315a86f2ed71db4a739f6c86a7c3ea4c9128
```

## 4. The draw

The bank's random interface is one function, `u32()`: **one `Generate(4)` call, read as a big-endian
unsigned 32-bit integer**. Everything else is built on it:

- `int(n)`: uniform in `[0, n)` by rejection: `limit = 2^32 − (2^32 mod n)`; draw `x = u32()`
  until `x < limit`; return `x mod n`.
- `between(lo, hi)` = `lo + int(hi − lo + 1)`.
- `pick(list)` = `list[int(len)]`.
- `shuffle(list)`: Fisher–Yates over a copy, `for i = len−1 down to 1: j = int(i+1); swap(i, j)`.
- `bigDigits(d)`: the first digit `between(1, 9)`, then `d − 1` digits `int(10)`, as a decimal integer.

Paper (`k` = 20, `perFamily` = 4, families in bank order `arith, logic, strings, spec, order`):

```
remaining[f] = perFamily for every family
for q = 1 .. k:
    candidates = families with remaining > 0, in bank order
    family     = candidates[ int(len(candidates)) ]
    remaining[family] -= 1
    (prompt, canonical) = family.generate(rng)      # the SAME stream, no reseeding between questions
    questions[q] = { id: q, family: family.id, prompt }
```

Each family's `generate` is the code in `src/families/*.ts` of `@mikeargento/exam-bank`, whose
bytes are in the generator archive the bank digest covers. The paper is the canonical JSON of

```json
{ "version": "exam-paper/1", "bankDigestB64": "...", "commitmentB64": "...", "k": 20,
  "questions": [ { "id": 1, "family": "arith", "prompt": "..." }, ... ] }
```

The canonical answers come out of the same draw and are not in the paper. Grading re-runs the draw.

## 5. The generator archive

A ustar archive of every `src/**/*.ts` file of `@mikeargento/exam-bank` except `src/__tests__/`,
entries sorted by path (byte order), each header with mode `0644`, uid `0`, gid `0`, mtime `0`,
typeflag `0`, magic `ustar\0` version `00`, no prefix, no PAX; content padded to 512 bytes; two
zero blocks at the end. `generatorTarDigestB64` = SHA-256 of the whole archive.

## 6. The two positions

- **Paper**: fused under placement `trailer/1` (`bitgraph-fuse/1`): the fused bytes are the paper's
  canonical JSON followed by the 48-byte trailer `"BGFUSE01" || 0x00 × 8 || commitment`; the
  proof's `artifact.digestB64` is SHA-256 of the fused bytes; `attribution` is
  `{ name: "bitgraph-fuse/1", title: "trailer/1", message: <SHA-256 of the paper JSON, base64> }`.
- **Answers**: `exam-answers/1` canonical JSON, recorded (no fuse, no attribution): the proof's
  `artifact.digestB64` is SHA-256 of `answers.json`. `paperDigestB64` inside it is the FUSED paper's
  digest. Its `commit.counter` must exceed the paper's on the same `epochId` and `chainId`.
- **Floors**: each proof's signed `commit.slotAnchor { counter, blockNumber, blockHash }`; the
  witness file's header must keccak-256 to `blockHash`; the header's 12th RLP field is the block
  timestamp. Print floors as "not before block N (header time T)". Never a ceiling. Never "at".

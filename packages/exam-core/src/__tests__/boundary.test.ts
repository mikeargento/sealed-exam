/**
 * The boundary against a mock site: nothing here reaches the network, and
 * nothing is committed. The slot record is a real enclave-signed one (the
 * enclave v10 app on the local harness, bitgraph's fuse3-fixtures).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { sha256 } from "@noble/hashes/sha256";
import { FuseError } from "@mikeargento/bitgraph";
import { computeSlotCommitment, getPlacement, type SlotAllocation } from "@mikeargento/bitgraph-verify";
import { b64, fuseUnderSlot, openPosition, signedFloorOf, BoundaryError } from "../index.js";

const SLOT: SlotAllocation = {
  version: "bitgraph/slot/1",
  nonceB64: "5psLgbY7G82e+dijTCIo2WmZuPYgakm4fHEsLdG4Me4=",
  counter: "1",
  epochId: "rGDc8XYP1C6nYkLSPxbkq5i2NRAG3UH6+6VflZzqHxo=",
  publicKeyB64: "3+PwwK1mceL6L2E21BuFF7KX5e+Y3bh7CF1EyE4KPmo=",
  chainId: "bitgraph:main",
  signatureB64: "PbwUvmOVDmWcvX0Co0DhTCZWsSzJN7S2ASR1W2qsQSNzJKRruwpIt3nyIiM1Cu4EJuxa+IJ157Xqc/SL4VhlCA==",
} as SlotAllocation;
const FLOOR = { chain: "base", evmChainId: 8453, blockNumber: 52271417, blockHash: "0x71d926aeae9847fcc15fad2d4de8871923f56862d42db7a7463e95a838f8f9b0", blockTimestamp: 1791332181 } as const;
const ANCHOR = { counter: "8592", blockNumber: 25962579, blockHash: "0xd00e6663d5fbe1418c8d683ec78bb1ba402a563ae42f47f66d1e3820c27e86cb" } as const;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("open keeps the Base floor the allocation names", async () => {
  const site: typeof fetch = async (input) => {
    assert.equal(String(input), "https://example.invalid/api/fuse/allocate");
    return json(200, { slotId: SLOT.nonceB64, slot: SLOT, chainId: "bitgraph:main", floor: FLOOR });
  };
  const opened = await openPosition({ baseUrl: "https://example.invalid", fetch: site });
  assert.deepEqual(opened.floor, FLOOR);
  assert.equal(opened.anchor, null);
  assert.deepEqual(opened.slot, SLOT);
});

test("NEGATIVE open refuses an allocation naming two floors", async () => {
  const site: typeof fetch = async () => json(200, { slotId: SLOT.nonceB64, slot: SLOT, chainId: "bitgraph:main", floor: FLOOR, anchor: ANCHOR });
  await assert.rejects(openPosition({ baseUrl: "https://example.invalid", fetch: site }), (e: unknown) => e instanceof BoundaryError && e.code === "malformed");
});

test("the held slot is fused WITHOUT a floor: core fuse() makes bitgraph-fuse/1 over the bare position commitment", async () => {
  const bytes = new TextEncoder().encode('{"version":"exam-paper/1"}');
  let body: Record<string, unknown> | null = null;
  const site: typeof fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/api/fuse/commit")) {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return json(400, { error: "mock: nothing is committed here" });
    }
    throw new Error(`unexpected request ${url}`);
  };
  await assert.rejects(fuseUnderSlot({ baseUrl: "https://example.invalid", fetch: site }, SLOT, bytes, "paper.fused.json"), (e: unknown) => e instanceof FuseError && e.code === "commit-refused");
  assert.ok(body !== null, "the commit was asked for");
  const b = body as Record<string, unknown>;
  assert.equal((b.attribution as { name: string }).name, "bitgraph-fuse/1");
  assert.equal((b.attribution as { title: string }).title, "trailer/1");
  assert.equal(b.floor, undefined, "no Base floor is bound");
  assert.equal(b.anchor, undefined, "no Ethereum anchor is bound");
  const fused = getPlacement("trailer/1")!.build({ original: bytes, originDigest: sha256(bytes), commitment: computeSlotCommitment(SLOT) });
  assert.equal((b.digests as Array<{ digestB64: string }>)[0]!.digestB64, b64(sha256(fused)), "the committed bytes carry computeSlotCommitment(slot)");
});

test("signedFloorOf names the chain: Base for slotFloor, Ethereum for slotAnchor, and refuses both", () => {
  const commit = { nonceB64: SLOT.nonceB64, counter: "2" };
  const base = signedFloorOf({ commit: { ...commit, slotFloor: FLOOR } } as never);
  assert.deepEqual(base, { chain: "base", blockNumber: FLOOR.blockNumber, blockHash: FLOOR.blockHash, blockTimestamp: FLOOR.blockTimestamp, counter: null });
  const eth = signedFloorOf({ commit: { ...commit, slotAnchor: ANCHOR } } as never);
  assert.deepEqual(eth, { chain: "ethereum", blockNumber: ANCHOR.blockNumber, blockHash: ANCHOR.blockHash, anchorCounter: ANCHOR.counter, counter: ANCHOR.counter });
  assert.equal(signedFloorOf({ commit } as never), null);
  assert.throws(() => signedFloorOf({ commit: { ...commit, slotFloor: FLOOR, slotAnchor: ANCHOR } } as never), /two floors/);
});

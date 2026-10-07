/**
 * The floor step, both chains.
 *
 * Base: test-fixtures/base-floor/ holds trailer3.proof.json, a proof minted
 * by the real enclave app (enclave v10 code on the local harness, stubbed
 * NSM: its attestation is not a Nitro document) that signs commit.slotFloor
 * for Base mainnet block 52271417, and that block's real header
 * (floor-base-52271417.rlp.hex), copied from bitgraph's
 * src/__tests__/fuse3-fixtures/. The attestation time is passed in, so the
 * floor-time rule is tested on its own.
 *
 * Ethereum: the honest fixture's paper, exactly as before.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BitGraphProof } from "@mikeargento/bitgraph-verify";
import { FLOOR_HEADER_VERSION, floorEvidenceFor, writeFloorEvidence } from "@mikeargento/exam-core";
import { floorStep, floorPhrase } from "../index.js";

const PKG = fileURLToPath(new URL("../../", import.meta.url));
const FIX = join(PKG, "test-fixtures", "base-floor");
const HONEST = join(PKG, "..", "exam-cli", "fixtures", "honest");

const BLOCK = 52271417;
const TS = 1791332181; // 1686789347 + 2 * 52271417
const HASH = "0x71d926aeae9847fcc15fad2d4de8871923f56862d42db7a7463e95a838f8f9b0";

const proof = async (): Promise<BitGraphProof> => JSON.parse(await readFile(join(FIX, "trailer3.proof.json"), "utf8")) as BitGraphProof;
const headerHex = async (): Promise<string> => (await readFile(join(FIX, "floor-base-52271417.rlp.hex"), "utf8")).trim();

/** A unit directory with base-floor/floor-header.json in the audit's bitgraph-floor-header/1 shape, as the CLI writes it. */
async function unit(file: Record<string, unknown> | null): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "exam-floor-"));
  if (file !== null) {
    await mkdir(join(dir, "base-floor"), { recursive: true });
    await writeFile(join(dir, "base-floor", "floor-header.json"), `${JSON.stringify(file, null, 2)}\n`);
  }
  return dir;
}

const goodFile = async (): Promise<Record<string, unknown>> => ({ version: FLOOR_HEADER_VERSION, chain: "base", evmChainId: 8453, blockNumber: BLOCK, blockHash: HASH, blockTimestamp: TS, header: await headerHex() });
const fails = <L extends { state: string }>(lines: L[]): L[] => lines.filter((l) => l.state === "FAIL");

test("Base floor: the header checks and its time is the floor", async () => {
  const dir = await unit(await goodFile());
  const r = await floorStep(1, await proof(), dir, "paper", (TS + 60) * 1000);
  assert.deepEqual(fails(r.lines), []);
  assert.equal(r.floor?.chain, "base");
  assert.equal(r.floor?.blockNumber, BLOCK);
  assert.equal(r.floor?.blockHash, HASH);
  assert.equal(r.floor?.time, TS);
  assert.equal(r.floor?.counter, null);
  assert.ok(r.lines.some((l) => l.name === "paper floor header" && l.state === "PASS"));
  assert.ok(!r.lines.some((l) => /anchor/.test(l.name)), "a Base floor reads no Ethereum anchors");
  assert.equal(floorPhrase(r.floor), "not before Base block 52271417 (header time 7 Oct 2026 00:16:21Z)");
  await rm(dir, { recursive: true });
});

test("Base floor: no attestation time in hand, the header time stands", async () => {
  const dir = await unit(await goodFile());
  const r = await floorStep(3, await proof(), dir, "answers", null);
  assert.deepEqual(fails(r.lines), []);
  assert.equal(r.floor?.time, TS);
  await rm(dir, { recursive: true });
});

test("Base floor: a block stamped after the attestation has its time withheld, stated and not FALSE", async () => {
  const dir = await unit(await goodFile());
  const r = await floorStep(1, await proof(), dir, "paper", (TS - 1) * 1000);
  assert.deepEqual(fails(r.lines), []);
  assert.equal(r.floor?.time, null);
  assert.match(r.floor?.timeWithheld ?? "", /after the attestation document/);
  const withheld = r.lines.find((l) => l.name === "paper floor time");
  assert.equal(withheld?.state, "UNDETERMINED");
  assert.match(withheld?.detail ?? "", /did not exist before Base block 52271417/);
  assert.equal(floorPhrase(r.floor), "not before Base block 52271417 (header time withheld: stamped after the attestation)");
  await rm(dir, { recursive: true });
});

test("Base floor: no header in the folder is NO-EVIDENCE for the time, never a failure", async () => {
  const dir = await unit(null);
  const r = await floorStep(1, await proof(), dir, "paper", null);
  assert.deepEqual(fails(r.lines), []);
  assert.equal(r.lines[0]?.state, "NO-EVIDENCE");
  assert.equal(r.floor?.blockNumber, BLOCK);
  assert.equal(r.floor?.time, null);
  assert.equal(floorPhrase(r.floor), "not before Base block 52271417 (header time not in hand)");
  await rm(dir, { recursive: true });
});

test("NEGATIVE Base floor: the wrong header (an Ethereum block's) fails", async () => {
  const eth = JSON.parse(await readFile(join(HONEST, "paper", "ethereum-anchors", "anchor-before-witness.json"), "utf8")) as { headerRlpHex: string };
  const dir = await unit({ ...(await goodFile()), header: eth.headerRlpHex });
  const r = await floorStep(1, await proof(), dir, "paper", null);
  assert.equal(fails(r.lines).length, 1);
  assert.match(fails(r.lines)[0]!.detail, /does not hash to the signed Base block hash/);
  assert.equal(r.floor?.time, null);
  await rm(dir, { recursive: true });
});

test("NEGATIVE Base floor: the right header given as the wrong chain fails", async () => {
  for (const chain of ["ethereum", undefined]) {
    const file = await goodFile();
    if (chain === undefined) delete file.chain; else file.chain = chain;
    const dir = await unit(file);
    const r = await floorStep(1, await proof(), dir, "paper", null);
    assert.equal(fails(r.lines).length, 1, String(chain));
    assert.match(fails(r.lines)[0]!.detail, /given as an Ethereum block, and the proof signs a Base block/);
    assert.equal(r.floor?.time, null);
    await rm(dir, { recursive: true });
  }
});

test("NEGATIVE Base floor: a signed time off Base's schedule fails before any header is read", async () => {
  const p = await proof();
  (p.commit as unknown as { slotFloor: { blockTimestamp: number } }).slotFloor.blockTimestamp = TS + 2;
  const dir = await unit(await goodFile());
  const r = await floorStep(1, p, dir, "paper", null);
  assert.equal(fails(r.lines).length, 1);
  assert.match(fails(r.lines)[0]!.detail, /not Base mainnet's schedule/);
  assert.equal(r.floor?.time, null);
  await rm(dir, { recursive: true });
});

test("NEGATIVE Base floor: a file that names another block than its header fails", async () => {
  const dir = await unit({ ...(await goodFile()), blockNumber: BLOCK + 1 });
  const r = await floorStep(1, await proof(), dir, "paper", null);
  assert.equal(fails(r.lines).length, 1);
  assert.match(fails(r.lines)[0]!.detail, /names a different block/);
  await rm(dir, { recursive: true });
});

test("NEGATIVE a proof that signs two floors floors nothing", async () => {
  const p = await proof();
  (p.commit as unknown as Record<string, unknown>).slotAnchor = { counter: "1", blockNumber: 1, blockHash: HASH };
  const dir = await unit(await goodFile());
  const r = await floorStep(1, p, dir, "paper", null);
  assert.equal(r.floor, null);
  assert.equal(fails(r.lines).length, 1);
  assert.match(fails(r.lines)[0]!.detail, /signs two floors/);
  await rm(dir, { recursive: true });
});

test("Ethereum floor: the honest fixture's paper reads as before", async () => {
  const p = JSON.parse(await readFile(join(HONEST, "paper", "proof.json"), "utf8")) as BitGraphProof;
  const r = await floorStep(1, p, join(HONEST, "paper"), "paper", null);
  assert.deepEqual(r.lines.map((l) => `${l.name} ${l.state}`), ["paper floor witness PASS", "paper floor anchor PASS"]);
  assert.equal(r.floor?.chain, "ethereum");
  assert.equal(r.floor?.blockNumber, 25962561);
  assert.ok(r.floor?.time !== null);
  assert.match(floorPhrase(r.floor), /^not before Ethereum block 25962561 \(header time 12 Sep 2026 16:34:35Z\)$/);
});

test("NEGATIVE Ethereum floor: a Base header file beside an Ethereum-floored proof is not its evidence", async () => {
  const p = JSON.parse(await readFile(join(HONEST, "paper", "proof.json"), "utf8")) as BitGraphProof;
  const dir = await unit(await goodFile());
  const r = await floorStep(1, p, dir, "paper", null);
  assert.equal(r.floor?.chain, "ethereum");
  assert.equal(r.floor?.time, null);
  assert.equal(r.lines[0]?.state, "NO-EVIDENCE");
  await rm(dir, { recursive: true });
});

test("the core writes base-floor/floor-header.json from the site's route, checked; the verifier reads it back", async () => {
  const header = await headerHex();
  const asked: string[] = [];
  const site: typeof fetch = async (input) => {
    const url = String(input);
    asked.push(url);
    if (url.includes("/api/proofs/floor-header?")) return new Response(JSON.stringify({ chain: "base", blockNumber: BLOCK, blockHash: HASH, blockTimestamp: TS, header }), { status: 200 });
    throw new Error(`unexpected request ${url}`);
  };
  const ev = await floorEvidenceFor({ baseUrl: "https://example.invalid", fetch: site }, await proof());
  assert.deepEqual(asked, [`https://example.invalid/api/proofs/floor-header?chain=base&block=${BLOCK}&hash=${encodeURIComponent(HASH)}`]);
  assert.equal(ev.dir, "base-floor");
  assert.equal(ev.anchors, null);
  assert.equal(ev.time, TS);
  const dir = await mkdtemp(join(tmpdir(), "exam-floor-"));
  await writeFloorEvidence(dir, ev);
  const written = JSON.parse(await readFile(join(dir, "base-floor", "floor-header.json"), "utf8")) as Record<string, unknown>;
  assert.deepEqual(written, await goodFile());
  await assert.rejects(readFile(join(dir, "ethereum-anchors", "anchors-status.json")));
  const r = await floorStep(1, await proof(), dir, "paper", null);
  assert.deepEqual(fails(r.lines), []);
  assert.equal(r.floor?.time, TS);
  await rm(dir, { recursive: true });
});

test("NEGATIVE the core writes nothing when the site's header does not check", async () => {
  const eth = JSON.parse(await readFile(join(HONEST, "paper", "ethereum-anchors", "anchor-before-witness.json"), "utf8")) as { headerRlpHex: string };
  for (const answer of [
    new Response(JSON.stringify({ chain: "base", blockNumber: BLOCK, blockHash: HASH, blockTimestamp: TS, header: eth.headerRlpHex }), { status: 200 }),
    new Response(JSON.stringify({ error: "no saved header for that Base block" }), { status: 404 }),
  ]) {
    const site: typeof fetch = async () => answer;
    const ev = await floorEvidenceFor({ baseUrl: "https://example.invalid", fetch: site }, await proof());
    assert.deepEqual(ev.files, []);
    assert.equal(ev.time, null);
    assert.ok(ev.note);
    const dir = await mkdtemp(join(tmpdir(), "exam-floor-"));
    await writeFloorEvidence(dir, ev);
    await assert.rejects(readFile(join(dir, "base-floor", "floor-header.json")));
    await rm(dir, { recursive: true });
  }
});

test("a re-export that cannot fetch the header keeps the one already in the folder", async () => {
  const dir = await unit(await goodFile());
  const site: typeof fetch = async () => new Response("{}", { status: 503 });
  await writeFloorEvidence(dir, await floorEvidenceFor({ baseUrl: "https://example.invalid", fetch: site }, await proof()));
  const r = await floorStep(1, await proof(), dir, "paper", null);
  assert.equal(r.floor?.time, TS);
  await rm(dir, { recursive: true });
});


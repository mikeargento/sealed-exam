// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * The exam's two positions on the chain, through the routes the site
 * already exposes. Nothing here is new to the enclave.
 *
 *   open           POST /api/fuse/allocate       a held slot record (the nonce never leaves this process except inside slot.json),
 *                                                and the floor the enclave fixed for it: a Base block since enclave v10
 *   paper          the real core fuse(): allocate is answered with the HELD slot and NO floor, so the paper is
 *                  bitgraph-fuse/1 (the bare position commitment); everything else goes to the boundary
 *   answers        POST /api/commit              a recorded position, the sheet's digest, no attribution
 *   floor          Base floor (commit.slotFloor):     GET /api/proofs/floor-header, checked, into base-floor/
 *                  Ethereum floor (commit.slotAnchor): GET /api/proofs/anchors + /api/proofs/witness, both sides,
 *                  into ethereum-anchors/ (papers made before 2026-10-07)
 */
import { sha256 } from "@noble/hashes/sha256";
import { builderFor, fuse, FuseError } from "@mikeargento/bitgraph";
import type { FuseResult } from "@mikeargento/bitgraph";
import { checkFloorHeader, computeSlotCommitment, evmHexToBytes, onBaseSchedule, signedFloorOf as verifySignedFloorOf, verifyProofIntegrity } from "@mikeargento/bitgraph-verify";
import type { BitGraphProof, SignedFloor, SlotAllocation } from "@mikeargento/bitgraph-verify";
import type { Bank } from "@mikeargento/exam-bank";
import { b64, derivePaper, type DerivedPaper } from "./paper.js";
import { blockTimeFromHeader, headerHash } from "./rlp.js";
import { ANCHOR_DIR, BASE_FLOOR_DIR, FLOOR_HEADER_FILE, remove, writeBytes } from "./folder.js";
import { join } from "node:path";

export const CHAIN = "bitgraph:main";
export const DEFAULT_BASE_URL = "https://bitgraph.ing";

export interface Transport {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class BoundaryError extends Error {
  constructor(readonly code: "tee-restarting" | "refused" | "network" | "malformed" | "slot-expired", message: string, readonly status: number | null = null) {
    super(message);
    this.name = "BoundaryError";
  }
}

function bound(t: Transport): Required<Pick<Transport, "baseUrl" | "fetch" | "timeoutMs">> & Transport {
  return { baseUrl: t.baseUrl ?? process.env.EXAM_BASE_URL ?? DEFAULT_BASE_URL, fetch: t.fetch ?? fetch, timeoutMs: t.timeoutMs ?? 30_000, ...(t.apiKey ? { apiKey: t.apiKey } : {}) };
}

async function call(t: Transport, path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<{ status: number; json: unknown }> {
  const b = bound(t);
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (b.apiKey) headers["Authorization"] = `Bearer ${b.apiKey}`;
  let res: Response;
  try {
    res = await b.fetch(`${b.baseUrl}${path}`, { method: init.method, headers, ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}), signal: AbortSignal.timeout(b.timeoutMs) });
  } catch (err) {
    throw new BoundaryError("network", `request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text.length > 0 ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

const B64_32 = /^[A-Za-z0-9+/]{43}=$/;
const B64_64 = /^[A-Za-z0-9+/]{86}==$/;

export function isSlotRecord(x: unknown): x is SlotAllocation {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const s = x as Record<string, unknown>;
  return s.version === "bitgraph/slot/1" && typeof s.nonceB64 === "string" && B64_32.test(s.nonceB64) && typeof s.counter === "string" && /^(0|[1-9][0-9]*)$/.test(s.counter)
    && typeof s.epochId === "string" && typeof s.publicKeyB64 === "string" && typeof s.signatureB64 === "string" && B64_64.test(s.signatureB64) && s.chainId === CHAIN;
}

/** The Base floor an enclave v10 allocation names: the block it signs at commit as commit.slotFloor. */
export interface BaseFloorMark {
  chain: "base";
  evmChainId: 8453;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
}

/** The Ethereum floor anchor an enclave v9 allocation names: the one it signs at commit as commit.slotAnchor. */
export interface AnchorMark {
  counter: string;
  blockNumber: number;
  blockHash: string;
}

export function isBaseFloorMark(x: unknown): x is BaseFloorMark {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const a = x as Record<string, unknown>;
  return a.chain === "base" && a.evmChainId === 8453
    && typeof a.blockNumber === "number" && Number.isSafeInteger(a.blockNumber) && a.blockNumber > 0
    && typeof a.blockHash === "string" && /^0x[0-9a-f]{64}$/.test(a.blockHash)
    && typeof a.blockTimestamp === "number" && Number.isSafeInteger(a.blockTimestamp);
}

export function isAnchorMark(x: unknown): x is AnchorMark {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const a = x as Record<string, unknown>;
  return typeof a.counter === "string" && /^(0|[1-9][0-9]*)$/.test(a.counter)
    && typeof a.blockNumber === "number" && Number.isSafeInteger(a.blockNumber) && a.blockNumber >= 0
    && typeof a.blockHash === "string" && /^0x[0-9a-f]{64}$/.test(a.blockHash);
}

export interface Opened {
  slot: SlotAllocation;
  /** The Base block the enclave fixed when it opened the position (enclave v10), or null. Unsigned here; the commit signs the same block as commit.slotFloor. */
  floor: BaseFloorMark | null;
  /** The Ethereum anchor an enclave v9 allocation names instead, or null. */
  anchor: AnchorMark | null;
}

/**
 * 1. open. The signed slot record and the floor the allocation names. A
 * response naming two floors is refused: a proof has one.
 */
export async function openPosition(t: Transport = {}): Promise<Opened> {
  const r = await call(t, "/api/fuse/allocate", { method: "POST", body: {} });
  const code = (r.json as { code?: unknown } | null)?.code;
  if (r.status === 503 && code === "tee-restarting") throw new BoundaryError("tee-restarting", "the boundary is restarting or waiting for its floor; try again in a moment", 503);
  if (r.status !== 200) throw new BoundaryError("refused", (r.json as { error?: string } | null)?.error ?? `allocation failed (${r.status})`, r.status);
  const body = r.json as { slot?: unknown; floor?: unknown; anchor?: unknown } | null;
  const slot = body?.slot;
  if (!isSlotRecord(slot)) throw new BoundaryError("malformed", "the allocation response is not a slot record on bitgraph:main");
  const floor = isBaseFloorMark(body?.floor) ? body.floor : null;
  const anchor = isAnchorMark(body?.anchor) ? body.anchor : null;
  if (floor !== null && anchor !== null) throw new BoundaryError("malformed", "the allocation names two floors (a Base block and an Ethereum anchor); a position has one");
  return { slot, floor, anchor };
}

/** 1. open, the slot record alone. */
export async function allocate(t: Transport = {}): Promise<SlotAllocation> {
  return (await openPosition(t)).slot;
}

export interface Floor {
  counter: string | null;
  blockNumber: number;
  blockHash: string;
  /** Unix seconds from the witnessed header, or null when no witness could be had. */
  time: number | null;
  anchor: Record<string, unknown> | null;
  witness: Record<string, unknown> | null;
}

/** The witness for one anchor block, checked by keccak before it is believed. */
export async function fetchWitness(t: Transport, blockNumber: number, blockHash: string): Promise<Record<string, unknown> | null> {
  const r = await call(t, `/api/proofs/witness?block=${blockNumber}&hash=${encodeURIComponent(blockHash)}`, { method: "GET" });
  if (r.status !== 200 || r.json === null || typeof r.json !== "object") return null;
  const w = r.json as Record<string, unknown>;
  if (typeof w.headerRlpHex !== "string" || headerHash(w.headerRlpHex)?.toLowerCase() !== blockHash.toLowerCase()) return null;
  return w;
}

export interface Side {
  state: string;
  note: string;
  anchor: Record<string, unknown> | null;
  witness: Record<string, unknown> | null;
}

/** One side of a position from the ledger. A failed read is `unavailable`, never an absence. */
export async function askSide(t: Transport, epochId: string, counter: string, side: "before" | "after"): Promise<Side> {
  const q = `counter=${encodeURIComponent(counter)}&epoch=${encodeURIComponent(epochId)}${side === "before" ? "&before=1" : ""}`;
  let r: { status: number; json: unknown };
  try {
    r = await call(t, `/api/proofs/anchors?${q}`, { method: "GET" });
  } catch (err) {
    return { state: "unavailable", note: `This side was not fetched: ${err instanceof Error ? err.message : String(err)}.`, anchor: null, witness: null };
  }
  if (r.status !== 200) return { state: "unavailable", note: `This side was not fetched: the ledger answered ${r.status}.`, anchor: null, witness: null };
  const data = r.json as { anchors?: Array<Record<string, unknown>>; bound?: { state?: string; note?: string } } | null;
  const anchor = data?.anchors?.[0] ?? null;
  if (anchor) {
    const a = (anchor.commit as { anchor?: { blockNumber?: number; blockHash?: string } } | undefined)?.anchor;
    const witness = a && typeof a.blockNumber === "number" && typeof a.blockHash === "string" ? await fetchWitness(t, a.blockNumber, a.blockHash) : null;
    return { state: "anchored", note: data?.bound?.note ?? "An Ethereum anchor bounds this position on this side.", anchor, witness };
  }
  const state = data?.bound?.state;
  if (typeof state !== "string") return { state: "unavailable", note: "This side was not fetched: the ledger gave no reason for the absence.", anchor: null, witness: null };
  return { state, note: data?.bound?.note ?? "", anchor: null, witness: null };
}

/** The floor a HELD slot stands on: the last anchor before its counter, from the ledger, with its witness. */
export async function floorOfSlot(t: Transport, slot: SlotAllocation): Promise<Floor | null> {
  const side = await askSide(t, slot.epochId, slot.counter, "before");
  if (side.anchor === null) return null;
  const a = (side.anchor.commit as { anchor?: { blockNumber?: number; blockHash?: string }; counter?: string } | undefined);
  if (!a?.anchor || typeof a.anchor.blockNumber !== "number" || typeof a.anchor.blockHash !== "string") return null;
  const header = (side.witness?.headerRlpHex as string | undefined) ?? null;
  return { counter: a.counter ?? null, blockNumber: a.anchor.blockNumber, blockHash: a.anchor.blockHash, time: header ? blockTimeFromHeader(header) : null, anchor: side.anchor, witness: side.witness };
}

/**
 * The floor a COMMITTED proof signs, whichever kind: a Base block
 * (commit.slotFloor, enclave v10) or an Ethereum anchor (commit.slotAnchor,
 * enclave v7 to v9), read through bitgraph-verify's signedFloorOf. `counter`
 * is the Ethereum anchor's position, null for a Base floor. Null when the
 * proof signs no floor; throws when it signs both (ambiguous, it floors nothing).
 */
export interface ExamSignedFloor extends SignedFloor {
  counter: string | null;
}

export function signedFloorOf(proof: BitGraphProof): ExamSignedFloor | null {
  const f = verifySignedFloorOf(proof);
  return f === null ? null : { ...f, counter: f.anchorCounter ?? null };
}

export interface FusedUnderSlot {
  slot: SlotAllocation;
  commitment: Uint8Array;
  proof: BitGraphProof;
  fusedBytes: Uint8Array;
  artifactDigestB64: string;
  originDigestB64: string;
  recovered: boolean;
  frame: FuseResult["frame"];
}

export interface FusedPaper extends DerivedPaper, FusedUnderSlot {}

/**
 * Commit ANY bytes under a HELD slot through the core's own fuse(): the
 * transport's fetch answers the allocate call with the held record and
 * forwards everything else, so the four beats, the lost-response recovery,
 * the same-slot guard, the post-commit verifyFuse and the Frame are all
 * the core's. The exam's paper and the slate's image both go through here.
 */
export async function fuseUnderSlot(t: Transport, slot: SlotAllocation, bytes: Uint8Array, fusedFile: string): Promise<FusedUnderSlot> {
  const b = bound(t);
  const commitment = computeSlotCommitment(slot);
  // The held slot is handed to the core's fuse() with NO floor, on purpose:
  // the core then makes bitgraph-fuse/1 (producerCommitment with no floor),
  // the bare position commitment the paper is derived from. The enclave still
  // signs the floor it fixed at allocation into the proof (commit.slotFloor on
  // v10), and the site accepts a floorless fuse/1 commit on a v10 position.
  const held: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith("/api/fuse/allocate") && (init?.method ?? "GET") === "POST") {
      return new Response(JSON.stringify({ slotId: slot.nonceB64, slot, chainId: CHAIN }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return b.fetch(input, init);
  };
  let r: FuseResult;
  try {
    r = await fuse(builderFor("trailer/1", bytes), {
      placement: "trailer/1",
      original: bytes,
      fusedFile,
      keepFused: true,
      transport: { baseUrl: b.baseUrl, fetch: held, timeoutMs: b.timeoutMs, ...(b.apiKey ? { apiKey: b.apiKey } : {}) },
    });
  } catch (err) {
    if (err instanceof FuseError && err.code === "slot-unavailable") throw new BoundaryError("slot-expired", "the held position is no longer available (a slot lives 120 s); open again", 409);
    if (err instanceof FuseError && err.code === "tee-restarting") throw new BoundaryError("tee-restarting", err.message, 503);
    throw err;
  }
  if (r.fusedBytes === undefined || r.originDigestB64 === null) throw new BoundaryError("malformed", "fuse returned no fused bytes or origin digest");
  if (r.proof.slotAllocation?.nonceB64 !== slot.nonceB64) throw new BoundaryError("malformed", "the proof is not under the held slot");
  return { slot, commitment, proof: r.proof, fusedBytes: r.fusedBytes, artifactDigestB64: r.artifactDigestB64, originDigestB64: r.originDigestB64, recovered: r.recovered, frame: r.frame };
}

/** 2, 3, 4 for the exam: derive the paper from the held slot's commitment and commit it under that slot. */
export async function fusePaper(t: Transport, slot: SlotAllocation, bank: Bank, derived?: DerivedPaper): Promise<FusedPaper> {
  const d = derived ?? derivePaper(computeSlotCommitment(slot), bank);
  const f = await fuseUnderSlot(t, slot, d.bytes, "paper.fused.json");
  return { ...d, ...f };
}

/** The answer sheet (or the bank): a recorded position, hash first, no fuse. */
export async function record(t: Transport, bytes: Uint8Array): Promise<BitGraphProof> {
  const digestB64 = b64(sha256(bytes));
  const r = await call(t, "/api/commit", { method: "POST", body: { digests: [{ digestB64, hashAlg: "sha256" }], chainId: CHAIN } });
  const code = (r.json as { code?: unknown } | null)?.code;
  if (r.status === 503 && code === "tee-restarting") throw new BoundaryError("tee-restarting", "the boundary is restarting or waiting for its floor; try again in a moment", 503);
  if (r.status !== 200) throw new BoundaryError("refused", (r.json as { error?: string } | null)?.error ?? `commit refused (${r.status})`, r.status);
  const proof = (Array.isArray(r.json) ? r.json[0] : (r.json as { proof?: unknown } | null)?.proof ?? r.json) as BitGraphProof | null;
  if (!proof || typeof proof !== "object" || proof.artifact?.digestB64 !== digestB64) throw new BoundaryError("malformed", "the commit response does not carry a proof of these bytes");
  const integrity = await verifyProofIntegrity({ proof });
  if (!integrity.valid) throw new BoundaryError("malformed", `the returned proof does not verify: ${integrity.reason}`);
  return proof;
}

export interface AnchorFiles {
  files: Array<{ name: string; text: string }>;
  before: Side;
  after: Side;
}

/**
 * Both sides of a committed position with an ETHEREUM floor (or none), as
 * the site writes them into ethereum-anchors/. A Base-floored proof has no
 * anchors; its evidence is floorEvidenceFor's base-floor/. The BEFORE side is the proof's own signed floor: the
 * anchor the enclave chose when the SLOT was allocated (commit.slotAnchor),
 * asked for by the slot counter, so the witness beside the proof is the
 * header of the floor block and not of some later anchor that landed
 * between the slot and the commit. If the ledger's answer is not that
 * anchor, only the floor's witness is written.
 */
export async function anchorFilesFor(t: Transport, proof: BitGraphProof, askedAt: Date = new Date()): Promise<AnchorFiles> {
  const epochId = proof.commit.epochId ?? "";
  const counter = proof.commit.counter ?? "";
  const floor = signedFloorOf(proof);
  const signed = floor?.chain === "ethereum" ? floor : null;
  const [before, after] = await Promise.all([askSide(t, epochId, proof.commit.slotCounter ?? counter, "before"), askSide(t, epochId, counter, "after")]);
  if (signed !== null) {
    const got = (before.anchor?.commit as { anchor?: { blockHash?: string } } | undefined)?.anchor?.blockHash?.toLowerCase();
    if (got !== signed.blockHash.toLowerCase()) {
      before.anchor = null;
      before.witness = await fetchWitness(t, signed.blockNumber, signed.blockHash);
      before.state = before.witness ? "anchored" : before.state;
    }
  }
  const files: Array<{ name: string; text: string }> = [];
  for (const [side, got] of [["before", before], ["after", after]] as const) {
    if (got.anchor) files.push({ name: `anchor-${side}.json`, text: `${JSON.stringify(got.anchor, null, 2)}\n` });
    if (got.witness) files.push({ name: `anchor-${side}-witness.json`, text: `${JSON.stringify(got.witness, null, 2)}\n` });
  }
  const settled = (s: string) => s === "anchored" || s === "closed" || s === "none";
  if (!settled(before.state) || !settled(after.state)) {
    files.push({
      name: "anchors-status.json",
      text: `${JSON.stringify({
        version: "bitgraph-anchor-status/1",
        position: { epochId, counter },
        before: { state: before.state, note: before.note, askedAt: askedAt.toISOString() },
        after: { state: after.state, note: after.note, askedAt: askedAt.toISOString() },
      }, null, 2)}\n`,
    });
  }
  return { files, before, after };
}

/** Write a position's anchor files into its ethereum-anchors/ directory, dropping a stale status file first. */
export async function writeAnchorFiles(dir: string, anchors: AnchorFiles): Promise<void> {
  await remove(join(dir, "anchors-status.json"));
  for (const f of anchors.files) await writeBytes(join(dir, f.name), f.text);
}

// ── Base floors (enclave v10) ───────────────────────────────────────────────

/** bitgraph-audit's floor header file format, as its carrier unpacker writes base-floor/floor-header.json. */
export const FLOOR_HEADER_VERSION = "bitgraph-floor-header/1";

export interface FloorHeaderFile {
  version: typeof FLOOR_HEADER_VERSION;
  chain: "base";
  evmChainId: 8453;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  /** The block header's RLP as 0x hex. The only evidence here; the other fields are for readers. */
  header: string;
}

/**
 * The header of the Base block a proof signs as its floor, from the site's
 * copy (GET /api/proofs/floor-header), believed only after checkFloorHeader:
 * keccak-256 to the signed hash, the signed number, the signed time, Base
 * mainnet's schedule. A failed read or a failed check is a note, never a file.
 */
export async function fetchBaseFloorHeader(t: Transport, signed: SignedFloor): Promise<{ file: FloorHeaderFile | null; note: string | null }> {
  if (signed.chain !== "base" || signed.blockTimestamp === undefined) return { file: null, note: "the proof does not sign a Base floor" };
  if (!onBaseSchedule(signed.blockNumber, signed.blockTimestamp)) return { file: null, note: `the signed time of Base block ${signed.blockNumber} is not Base mainnet's schedule for that block` };
  let r: { status: number; json: unknown };
  try {
    r = await call(t, `/api/proofs/floor-header?chain=base&block=${signed.blockNumber}&hash=${encodeURIComponent(signed.blockHash)}`, { method: "GET" });
  } catch (err) {
    return { file: null, note: `the request failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (r.status !== 200) return { file: null, note: `the site answered ${r.status}` };
  const header = (r.json as { header?: unknown } | null)?.header;
  const raw = typeof header === "string" ? evmHexToBytes(header) : null;
  if (raw === null) return { file: null, note: "the site's answer carries no header" };
  const checked = checkFloorHeader(signed, raw, "base");
  if (!checked.ok) return { file: null, note: `the site's header does not check: ${checked.reason}` };
  return {
    file: {
      version: FLOOR_HEADER_VERSION,
      chain: "base",
      evmChainId: 8453,
      blockNumber: checked.header.number,
      blockHash: checked.header.hash,
      blockTimestamp: checked.header.timestamp,
      header: (header as string).toLowerCase().startsWith("0x") ? (header as string).toLowerCase() : `0x${(header as string).toLowerCase()}`,
    },
    note: null,
  };
}

export interface FloorEvidence {
  /** The floor the proof signs, or null when it signs none. */
  floor: ExamSignedFloor | null;
  /** The directory beside proof.json the evidence goes in. */
  dir: typeof BASE_FLOOR_DIR | typeof ANCHOR_DIR;
  files: Array<{ name: string; text: string }>;
  /** Unix seconds from a checked header, or null when none is in hand. */
  time: number | null;
  /** Why no header is in hand, when none is. */
  note: string | null;
  /** The Ethereum sides, for an Ethereum floor (or none). Null for a Base floor: it has no anchors. */
  anchors: AnchorFiles | null;
}

/**
 * The floor's evidence for a committed proof, by the floor it signs. Base:
 * base-floor/floor-header.json, no anchors, no anchors-status. Ethereum (and
 * a proof that signs none): ethereum-anchors/, exactly as before.
 */
export async function floorEvidenceFor(t: Transport, proof: BitGraphProof, askedAt: Date = new Date()): Promise<FloorEvidence> {
  const floor = signedFloorOf(proof);
  if (floor?.chain === "base") {
    const got = await fetchBaseFloorHeader(t, floor);
    return {
      floor,
      dir: BASE_FLOOR_DIR,
      files: got.file ? [{ name: FLOOR_HEADER_FILE, text: `${JSON.stringify(got.file, null, 2)}\n` }] : [],
      time: got.file ? got.file.blockTimestamp : null,
      note: got.note,
      anchors: null,
    };
  }
  const anchors = await anchorFilesFor(t, proof, askedAt);
  const w = anchors.before.witness;
  const time = floor !== null && w !== null && w.blockNumber === floor.blockNumber && typeof w.headerRlpHex === "string" ? blockTimeFromHeader(w.headerRlpHex) : null;
  return { floor, dir: ANCHOR_DIR, files: anchors.files, time, note: null, anchors };
}

/** Write a unit's floor evidence into <unitDir>/base-floor/ or <unitDir>/ethereum-anchors/. A Base header not in hand leaves any earlier one in place. */
export async function writeFloorEvidence(unitDir: string, ev: FloorEvidence): Promise<void> {
  if (ev.anchors !== null) { await writeAnchorFiles(join(unitDir, ANCHOR_DIR), ev.anchors); return; }
  for (const f of ev.files) await writeBytes(join(unitDir, ev.dir, f.name), f.text);
}

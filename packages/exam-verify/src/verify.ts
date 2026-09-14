// Copyright (c) Argento Computing Inc. Licensed under the MIT License. See LICENSE.

/**
 * `exam verify <folder>`: entirely offline, three words.
 *
 *   NO-EVIDENCE   something the claim needs is not in the folder, or this
 *                 verifier cannot re-derive what it holds (a bank it does
 *                 not know, a cross-epoch pair). Not a finding against the run.
 *   REJECT        something in the folder recomputes and disagrees: the
 *                 paper, the commitment, the answers, or the order.
 *   ACCEPT        everything checks, and the score is what re-running the
 *                 checkers says. Never read from a file.
 *
 * The steps of the brief, in order. Step 1 verifies the paper's BitGraph
 * as trailer/1 today does (bitgraph-verify's verifyFuse, the audit
 * package's Nitro attestation validator, the witness by keccak). Step 2
 * re-derives the paper from the recomputed commitment and the shipped bank.
 * Step 3 verifies the answer sheet's BitGraph, its binding to the fused
 * paper, and its place after the paper. Step 4 grades.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@noble/hashes/sha256";
import { validateNitroAttestationDocument } from "@mikeargento/bitgraph-audit";
import { KNOWN_ENCLAVE_MEASUREMENTS } from "@mikeargento/bitgraph-player";
import { TRAILER_LENGTH, canonicalize, computeSignedBodyHash, computeSlotCommitment, getPlacement, readFuseAttribution, verifyFuse, verifyProofIntegrity } from "@mikeargento/bitgraph-verify";
import type { BitGraphProof } from "@mikeargento/bitgraph-verify";
import { computeBankDigest, familyById, generatorSourceTar, isBank, type Bank } from "@mikeargento/exam-bank";
import { CLAIM, b64, blockTimeFromHeader, derivePaper, fromB64, headerHash, isPaper, paths, readBytes, readJson, type Paper } from "@mikeargento/exam-core";

export type Verdict = "ACCEPT" | "REJECT" | "NO-EVIDENCE";
export type LineState = "PASS" | "FAIL" | "NO-EVIDENCE" | "UNDETERMINED";
export type Disagreed = "paper" | "commitment" | "answers" | "order";

export interface Line { step: 1 | 2 | 3 | 4; name: string; state: LineState; detail: string }

export interface FloorReport {
  counter: string | null;
  blockNumber: number;
  blockHash: string;
  /** Unix seconds from the witnessed header; null when no witness could be checked. */
  time: number | null;
}

export interface PositionReport {
  epochId: string;
  counter: string;
  slotCounter: string | null;
  chainId: string | null;
  floor: FloorReport | null;
}

export interface QuestionReport {
  id: number;
  family: string;
  prompt: string;
  answer: string | null;
  canonical: string;
  correct: boolean | null;
}

export interface ExamVerdict {
  version: "exam-verdict/1";
  verdict: Verdict;
  /** Player convention: ACCEPT 0, REJECT 1, NO-EVIDENCE 2. */
  exitCode: 0 | 1 | 2;
  /** One plain sentence: what disagreed, or what is missing. Null on ACCEPT. */
  reason: string | null;
  disagreed: Disagreed | null;
  missing: string[];
  score: { correct: number; k: number } | null;
  families: Array<{ id: string; title: string; correct: number; total: number }>;
  questions: QuestionReport[];
  paper: PositionReport | null;
  answers: PositionReport | null;
  model: { provider: string; id: string; reportedVersion: string | null } | null;
  lines: Line[];
  notes: string[];
  claim: { sentence: string | null; proves: string; doesNotProve: string; footer: string };
}

interface Sheet {
  version: string;
  paperDigestB64: string;
  model: { provider: string; id: string; reportedVersion: string | null };
  raw: string;
  answers: Array<{ id: number; answer: string; rawDigestB64: string }>;
}

const isSheet = (x: unknown): x is Sheet => {
  if (x === null || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return s.version === "exam-answers/1" && typeof s.paperDigestB64 === "string" && typeof s.model === "object" && s.model !== null && Array.isArray(s.answers);
};

const bytesEq = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

async function attestationLine(step: 1 | 3, proof: BitGraphProof, what: string): Promise<Line[]> {
  const out: Line[] = [];
  const report = proof.environment?.attestation?.reportB64;
  if (typeof report !== "string") {
    out.push({ step, name: `${what} attestation`, state: "NO-EVIDENCE", detail: `the ${what}'s proof carries no attestation document` });
    return out;
  }
  const expectedUserDataB64 = computeSignedBodyHash(proof);
  const r = await validateNitroAttestationDocument(report, { expectedPcr0: proof.environment.measurement, expectedUserDataB64 });
  const failed = r.checks.find((c) => !c.pass);
  if (!r.documentValid || failed !== undefined) {
    out.push({ step, name: `${what} attestation`, state: "FAIL", detail: `AWS Nitro attestation: ${failed?.detail ?? r.failure ?? "invalid"}` });
    return out;
  }
  out.push({ step, name: `${what} attestation`, state: "PASS", detail: `AWS Nitro attestation chains to the AWS root; PCR0 equals the proof's measurement; user_data is this proof's signed body` });
  const known = KNOWN_ENCLAVE_MEASUREMENTS.find((m) => m.pcr0 === (r.pcr0 ?? "").toLowerCase());
  out.push(known
    ? { step, name: `${what} enclave`, state: "PASS", detail: `PCR0 is the published BitGraph ${known.label} measurement (${known.period})` }
    : { step, name: `${what} enclave`, state: "UNDETERMINED", detail: `PCR0 ${(r.pcr0 ?? "").slice(0, 16)}… is not among the BitGraph enclave measurements this verifier knows` });
  return out;
}

async function floorOf(step: 1 | 3, proof: BitGraphProof, anchorsDir: string, what: string, lines: Line[]): Promise<FloorReport | null> {
  const s = proof.commit.slotAnchor;
  if (!s || typeof s.blockNumber !== "number" || typeof s.blockHash !== "string") {
    lines.push({ step, name: `${what} floor`, state: "NO-EVIDENCE", detail: `the ${what}'s proof carries no signed floor (commit.slotAnchor); it was signed by an enclave older than v7 or is not a chain proof` });
    return null;
  }
  const floor: FloorReport = { counter: typeof s.counter === "string" ? s.counter : null, blockNumber: s.blockNumber, blockHash: s.blockHash.toLowerCase(), time: null };
  const witness = await readJson<{ headerRlpHex?: unknown; blockNumber?: unknown; blockHash?: unknown }>(join(anchorsDir, "anchor-before-witness.json"));
  if (witness === null || typeof witness.headerRlpHex !== "string") {
    lines.push({ step, name: `${what} floor witness`, state: "NO-EVIDENCE", detail: `no anchor-before-witness.json beside the ${what}'s proof; the floor block is signed, its header time is not in hand` });
  } else {
    const hash = headerHash(witness.headerRlpHex);
    const time = blockTimeFromHeader(witness.headerRlpHex);
    if (hash === null || hash.toLowerCase() !== floor.blockHash || witness.blockNumber !== floor.blockNumber || time === null) {
      lines.push({ step, name: `${what} floor witness`, state: "FAIL", detail: `the witness header beside the ${what}'s proof does not hash to the signed floor block ${floor.blockNumber}` });
    } else {
      floor.time = time;
      lines.push({ step, name: `${what} floor witness`, state: "PASS", detail: `the block header hashes to the signed floor block ${floor.blockNumber}; its timestamp is the floor` });
    }
  }
  const anchor = await readJson<BitGraphProof>(join(anchorsDir, "anchor-before.json"));
  if (anchor !== null) {
    // Corroboration, not the floor: the floor is the proof's own signed slotAnchor.
    const valid = (await verifyProofIntegrity({ proof: anchor })).valid && anchor.commit?.anchor !== undefined;
    const isFloor = valid && anchor.commit?.anchor?.blockHash?.toLowerCase() === floor.blockHash;
    let before = false;
    try { before = valid && BigInt(anchor.commit?.counter ?? "0") < BigInt(proof.commit.counter ?? "0") && anchor.commit?.epochId === proof.commit.epochId; } catch { before = false; }
    lines.push(!valid
      ? { step, name: `${what} floor anchor`, state: "FAIL", detail: `anchor-before.json beside the ${what}'s proof is not a valid anchor proof` }
      : isFloor
        ? { step, name: `${what} floor anchor`, state: "PASS", detail: `anchor-before.json is the signed anchor at position ${anchor.commit?.counter} for the floor block ${floor.blockNumber}` }
        : before
          ? { step, name: `${what} floor anchor`, state: "PASS", detail: `anchor-before.json is a valid anchor at position ${anchor.commit?.counter}, before this position; the floor itself is the proof's signed slotAnchor` }
          : { step, name: `${what} floor anchor`, state: "FAIL", detail: `anchor-before.json beside the ${what}'s proof is not before this position` });
  }
  return floor;
}

function positionOf(proof: BitGraphProof, floor: FloorReport | null): PositionReport {
  return { epochId: proof.commit.epochId ?? "", counter: proof.commit.counter ?? "", slotCounter: proof.commit.slotCounter ?? null, chainId: (proof.commit as { chainId?: string }).chainId ?? null, floor };
}

export async function verifyExam(root: string): Promise<ExamVerdict> {
  const lines: Line[] = [];
  const notes: string[] = [];
  const missing: string[] = [];
  let disagreed: Disagreed | null = null;
  let reason: string | null = null;
  let undetermined: string | null = null;
  const fail = (d: Disagreed, sentence: string) => { if (disagreed === null) { disagreed = d; reason = sentence; } };

  // ── the folder ──────────────────────────────────────────────────────────
  const bankJson = await readBytes(paths.bank.json(root));
  const bank = bankJson === null ? null : (JSON.parse(new TextDecoder().decode(bankJson)) as unknown);
  const tar = await readBytes(paths.bank.tar(root));
  const paperProof = await readJson<BitGraphProof>(paths.paper.proof(root));
  let fused = await readBytes(paths.paper.fused(root));
  const originFile = await readBytes(paths.paper.json(root));
  const sheetBytes = await readBytes(paths.answers.json(root));
  const sheetProof = await readJson<BitGraphProof>(paths.answers.proof(root));
  if (bank === null || !isBank(bank)) missing.push("bank/bank.json");
  if (tar === null) missing.push("bank/generator.tar");
  if (paperProof === null) missing.push("paper/proof.json");
  if (fused === null && originFile === null) missing.push("paper/new-file/paper.fused.json (or paper/paper.json)");
  if (sheetBytes === null) missing.push("answers/answers.json");
  if (sheetProof === null) missing.push("answers/proof.json");
  if (existsSync(join(root, "grade.json"))) notes.push("A grade.json was found in the folder and was not read; the score below was recomputed by running the checkers.");

  const empty = (verdict: Verdict, r: string): ExamVerdict => ({
    version: "exam-verdict/1", verdict, exitCode: verdict === "ACCEPT" ? 0 : verdict === "REJECT" ? 1 : 2, reason: r, disagreed, missing, score: null, families: [], questions: [],
    paper: null, answers: null, model: null, lines, notes, claim: { sentence: null, proves: CLAIM.proves, doesNotProve: CLAIM.doesNotProve, footer: CLAIM.footer },
  });
  if (missing.length > 0) return empty("NO-EVIDENCE", `Missing from the folder: ${missing.join(", ")}. Nothing here is a finding against the run; the files are simply not in hand.`);
  const theBank = bank as Bank;

  // ── step 1: the paper's BitGraph ────────────────────────────────────────
  const slot = paperProof!.slotAllocation;
  let commitment: Uint8Array | null = null;
  try { if (slot) commitment = computeSlotCommitment(slot); } catch { commitment = null; }
  if (commitment === null) {
    lines.push({ step: 1, name: "paper slot", state: "FAIL", detail: "the paper's proof carries no slot record to recompute a commitment from" });
    fail("commitment", "The paper's proof carries no slot record, so no commitment can be recomputed.");
  }
  if (fused === null && originFile !== null && commitment !== null) {
    // Only the origin is in hand: rebuild the fused bytes with the registered placement, as the site does.
    fused = getPlacement("trailer/1")!.build({ original: originFile, originDigest: sha256(originFile), commitment });
    notes.push("paper/new-file/paper.fused.json is absent; the fused bytes were rebuilt from paper/paper.json with placement trailer/1.");
  }
  const fusedBytes = fused!;
  const origin = fusedBytes.length > TRAILER_LENGTH ? fusedBytes.subarray(0, fusedBytes.length - TRAILER_LENGTH) : new Uint8Array(0);
  const trailerCommitment = fusedBytes.length >= 32 ? fusedBytes.subarray(fusedBytes.length - 32) : new Uint8Array(0);
  const fv = await verifyFuse({ proof: paperProof!, bytes: fusedBytes });
  if (fv.category === "FUSED_DIRECT") {
    lines.push({ step: 1, name: "paper proof", state: "PASS", detail: `bitgraph-verify: ${fv.category}; signature, slot record and binding verify; the fused bytes hash to the committed digest and carry the slot's commitment under ${fv.placement}` });
  } else {
    lines.push({ step: 1, name: "paper proof", state: "FAIL", detail: `bitgraph-verify: ${fv.category}${fv.reason ? ` (${fv.reason})` : ""}` });
    if (!fv.proof.valid) fail("paper", `The paper's proof does not verify: ${fv.proof.reason ?? fv.category}.`);
    else if (commitment !== null && !bytesEq(trailerCommitment, commitment)) fail("commitment", `The commitment in the paper's trailer is not the commitment of the slot this proof was signed under; the paper was fused for a different position.`);
    else fail("paper", `The fused paper does not hash to the digest the paper's proof committed (${fv.category}).`);
  }
  const marker = readFuseAttribution(paperProof!);
  const originDigest = sha256(origin);
  if (marker === null || marker.placement !== "trailer/1") {
    lines.push({ step: 1, name: "paper marker", state: "FAIL", detail: "the paper's signed attribution does not mark it bitgraph-fuse/1 under trailer/1" });
    fail("paper", "The paper's proof is not marked as fused under trailer/1.");
  } else if (marker.originDigest === undefined || !bytesEq(marker.originDigest, originDigest)) {
    lines.push({ step: 1, name: "paper origin", state: "FAIL", detail: "the origin digest recovered by stripping the trailer is not the one the signed attribution names" });
    fail("paper", "The paper recovered by stripping the trailer is not the origin the proof's signed attribution names.");
  } else {
    lines.push({ step: 1, name: "paper origin", state: "PASS", detail: "stripping the 48-byte trailer recovers the origin the signed attribution names" });
  }
  lines.push(...(await attestationLine(1, paperProof!, "paper")));
  const paperFloor = await floorOf(1, paperProof!, paths.paper.anchors(root), "paper", lines);
  if (paperFloor === null && undetermined === null) undetermined = "The paper's proof carries no signed floor, so nothing can be said about a block it could not have existed before.";
  if (originFile !== null && !bytesEq(originFile, origin)) {
    lines.push({ step: 1, name: "paper copy", state: "FAIL", detail: "paper/paper.json is not the origin recovered from the fused bytes" });
    fail("paper", "The paper.json beside the proof is not the paper the proof committed.");
  }

  // ── step 2: the bank, the seed, the paper re-derived ────────────────────
  let paper: Paper | null = null;
  try { const p = JSON.parse(new TextDecoder().decode(origin)) as unknown; if (isPaper(p)) paper = p; } catch { paper = null; }
  if (paper === null) {
    lines.push({ step: 2, name: "paper shape", state: "FAIL", detail: "the origin bytes are not an exam-paper/1 document" });
    fail("paper", "The committed paper is not an exam-paper/1 document.");
  }
  const tarDigest = b64(sha256(tar!));
  const bankOk = computeBankDigest(theBank) === theBank.bankDigestB64 && tarDigest === theBank.generatorTarDigestB64;
  if (!bankOk) {
    lines.push({ step: 2, name: "bank digest", state: "FAIL", detail: "bank/bank.json's digest does not recompute from its content and bank/generator.tar" });
    fail("paper", "The bank in the folder does not recompute to the digest it claims.");
  } else if (paper !== null && paper.bankDigestB64 !== theBank.bankDigestB64) {
    lines.push({ step: 2, name: "bank digest", state: "FAIL", detail: "the paper names a bank digest that is not the shipped bank's" });
    fail("paper", "The paper names a bank that is not the bank in the folder.");
  } else {
    lines.push({ step: 2, name: "bank digest", state: "PASS", detail: `bank/bank.json recomputes to ${theBank.bankDigestB64.slice(0, 12)}… from its content and the generator archive, and the paper names it` });
  }
  const ownTar = await generatorSourceTar();
  const ownTarDigest = b64(sha256(ownTar));
  let derived: ReturnType<typeof derivePaper> | null = null;
  if (ownTarDigest !== tarDigest) {
    lines.push({ step: 2, name: "bank known", state: "UNDETERMINED", detail: `this verifier's generator source (${ownTarDigest.slice(0, 12)}…) is not the folder's (${tarDigest.slice(0, 12)}…); it cannot re-derive that bank's paper` });
    undetermined ??= "The bank in the folder is not the bank this verifier was built from, so the paper cannot be re-derived here. Not a finding against the run.";
  } else {
    lines.push({ step: 2, name: "bank known", state: "PASS", detail: "the folder's generator archive is byte for byte this verifier's own" });
    if (commitment !== null && paper !== null) {
      try { derived = derivePaper(commitment, theBank); } catch (err) { derived = null; lines.push({ step: 2, name: "paper re-derived", state: "FAIL", detail: `derivation threw: ${err instanceof Error ? err.message : String(err)}` }); }
      if (derived !== null) {
        if (bytesEq(derived.bytes, origin)) lines.push({ step: 2, name: "paper re-derived", state: "PASS", detail: `re-instantiating all ${derived.paper.k} questions from the recomputed commitment and the bank digest reproduces the committed paper byte for byte` });
        else {
          const canon = (q: unknown) => Buffer.from(canonicalize(q as unknown as BitGraphProof)).toString("base64");
          const first = derived.paper.questions.findIndex((q, i) => canon(q) !== canon(paper!.questions[i]));
          lines.push({ step: 2, name: "paper re-derived", state: "FAIL", detail: `the paper this slot produces differs from the committed one${first >= 0 ? ` (first difference at question ${first + 1})` : ""}` });
          fail("paper", `The committed paper is not the paper this slot produces${first >= 0 ? `: question ${first + 1} differs` : ""}.`);
        }
      }
    }
  }

  // ── step 3: the answer sheet ────────────────────────────────────────────
  let sheet: Sheet | null = null;
  try { const s = JSON.parse(new TextDecoder().decode(sheetBytes!)) as unknown; if (isSheet(s)) sheet = s; } catch { sheet = null; }
  if (sheet === null) {
    lines.push({ step: 3, name: "answers shape", state: "FAIL", detail: "answers/answers.json is not an exam-answers/1 document" });
    fail("answers", "The answer sheet is not an exam-answers/1 document.");
  }
  const fusedDigest = b64(sha256(fusedBytes));
  if (sheet !== null) {
    if (sheet.paperDigestB64 === fusedDigest) lines.push({ step: 3, name: "answers name the paper", state: "PASS", detail: "paperDigestB64 is the fused paper's digest" });
    else { lines.push({ step: 3, name: "answers name the paper", state: "FAIL", detail: "paperDigestB64 is not the fused paper's digest" }); fail("answers", "The answer sheet names a different paper than the one in this folder."); }
  }
  const pe = paperProof!.commit.epochId, ae = sheetProof!.commit.epochId;
  const pc = (paperProof!.commit as { chainId?: string }).chainId, ac = (sheetProof!.commit as { chainId?: string }).chainId;
  if (pe !== ae || pc !== ac) {
    lines.push({ step: 3, name: "order", state: "UNDETERMINED", detail: "the paper and the answers sit in different epochs or chains; counters are not comparable across them" });
    undetermined ??= "The paper and the answers were committed in different epochs, and counters do not compare across epochs; their order is undetermined here.";
  } else {
    let after = false;
    try { after = BigInt(sheetProof!.commit.counter ?? "0") > BigInt(paperProof!.commit.counter ?? "0"); } catch { after = false; }
    if (after) lines.push({ step: 3, name: "order", state: "PASS", detail: `the answers sit at position ${sheetProof!.commit.counter}, after the paper at ${paperProof!.commit.counter}, same epoch, same chain` });
    else { lines.push({ step: 3, name: "order", state: "FAIL", detail: `the answers sit at position ${sheetProof!.commit.counter}, not after the paper at ${paperProof!.commit.counter}` }); fail("order", `The answer sheet sits at position ${sheetProof!.commit.counter}, which is not after the paper at position ${paperProof!.commit.counter}.`); }
  }
  const sheetDigest = b64(sha256(sheetBytes!));
  if (sheetProof!.artifact?.digestB64 !== sheetDigest) {
    lines.push({ step: 3, name: "answers proof", state: "FAIL", detail: "answers/answers.json does not hash to the digest answers/proof.json committed" });
    fail("answers", "The answer sheet does not hash to the digest its proof committed.");
  } else {
    const integrity = await verifyProofIntegrity({ proof: sheetProof! });
    lines.push(integrity.valid
      ? { step: 3, name: "answers proof", state: "PASS", detail: "the sheet hashes to the committed digest; signature, slot record and binding verify" }
      : { step: 3, name: "answers proof", state: "FAIL", detail: `bitgraph-verify: ${integrity.reason}` });
    if (!integrity.valid) fail("answers", `The answer sheet's proof does not verify: ${integrity.reason}.`);
  }
  lines.push(...(await attestationLine(3, sheetProof!, "answers")));
  const answersFloor = await floorOf(3, sheetProof!, paths.answers.anchors(root), "answers", lines);
  let refused = 0;
  if (sheet !== null) {
    let checked = 0, absent = 0;
    for (const a of sheet.answers) {
      const raw = await readBytes(paths.raw.file(root, a.id));
      if (raw === null) { absent++; continue; }
      checked++;
      try { if ((JSON.parse(new TextDecoder().decode(raw)) as { incomplete?: unknown }).incomplete === true) refused++; } catch { /* judged by digest below */ }
      if (b64(sha256(raw)) !== a.rawDigestB64) { lines.push({ step: 3, name: `raw q${a.id}`, state: "FAIL", detail: `raw/q${String(a.id).padStart(2, "0")}.json does not hash to the digest the sheet names` }); fail("answers", `The raw reply for question ${a.id} is not the one the answer sheet names.`); }
    }
    if (checked > 0) lines.push({ step: 3, name: "raw replies", state: "PASS", detail: `${checked} raw repl${checked === 1 ? "y" : "ies"} hash to the digests the sheet names` });
    if (absent > 0) lines.push({ step: 3, name: "raw replies", state: "NO-EVIDENCE", detail: sheet.raw === "carried" ? `${absent} raw replies the sheet says are carried are not in the folder; their digests stand as declared` : `${absent} raw replies are declared, not carried` });
  }

  // ── step 4: grade ───────────────────────────────────────────────────────
  const questions: QuestionReport[] = [];
  const families: ExamVerdict["families"] = [];
  let score: ExamVerdict["score"] = null;
  if (derived !== null && sheet !== null) {
    const byId = new Map(sheet.answers.map((a) => [a.id, a.answer]));
    let correct = 0;
    const perFamily = new Map<string, { correct: number; total: number }>();
    for (let i = 0; i < derived.paper.questions.length; i++) {
      const q = derived.paper.questions[i]!;
      const canonical = derived.canonical[i]!;
      const family = familyById(q.family)!;
      const answer = byId.get(q.id) ?? null;
      const ok = answer === null ? false : await family.check(answer, canonical);
      if (ok) correct++;
      const f = perFamily.get(q.family) ?? { correct: 0, total: 0 };
      f.total++; if (ok) f.correct++;
      perFamily.set(q.family, f);
      questions.push({ id: q.id, family: q.family, prompt: q.prompt, answer, canonical: family.display(canonical), correct: ok });
    }
    for (const bf of theBank.families) { const f = perFamily.get(bf.id) ?? { correct: 0, total: 0 }; families.push({ id: bf.id, title: bf.title, correct: f.correct, total: f.total }); }
    score = { correct, k: derived.paper.k };
    if (refused > 0) notes.push(`${refused} of the ${derived.paper.k} replies came back refused or truncated by the provider (recorded in raw/ as incomplete) and count as wrong.`);
    lines.push({ step: 4, name: "grade", state: "PASS", detail: `${correct}/${derived.paper.k} by re-running each family's checker on the re-derived canonical answers` });
  }

  // ── the verdict ─────────────────────────────────────────────────────────
  // A line that FAILED without naming what disagreed (a witness that does not
  // hash, an anchor that is not the floor's) is still a contradiction.
  const firstFail = lines.find((l) => l.state === "FAIL");
  if (disagreed === null && firstFail !== undefined) fail(firstFail.step === 3 ? "answers" : "paper", `${firstFail.detail.charAt(0).toUpperCase()}${firstFail.detail.slice(1)}.`);
  const verdict: Verdict = disagreed !== null ? "REJECT" : undetermined !== null ? "NO-EVIDENCE" : "ACCEPT";
  const paperPos = positionOf(paperProof!, paperFloor);
  return {
    version: "exam-verdict/1",
    verdict,
    exitCode: verdict === "ACCEPT" ? 0 : verdict === "REJECT" ? 1 : 2,
    reason: verdict === "REJECT" ? reason : verdict === "NO-EVIDENCE" ? undetermined : null,
    disagreed: verdict === "REJECT" ? disagreed : null,
    missing,
    score,
    families,
    questions,
    paper: paperPos,
    answers: positionOf(sheetProof!, answersFloor),
    model: sheet?.model ?? null,
    lines,
    notes,
    claim: { sentence: paperFloor ? CLAIM.sentence(paperFloor.blockNumber) : null, proves: CLAIM.proves, doesNotProve: CLAIM.doesNotProve, footer: CLAIM.footer },
  };
}

/** The commitment bytes of a proof's slot, for callers that need it beside the verdict. */
export function commitmentOf(proof: BitGraphProof): Uint8Array | null {
  try { return proof.slotAllocation ? computeSlotCommitment(proof.slotAllocation) : null; } catch { return null; }
}

export { fromB64 };

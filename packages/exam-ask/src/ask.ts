// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Ask, then seal. Reads the committed paper from the run folder, asks the
 * model one question at a time, writes each raw exchange under raw/, writes
 * the answer sheet, and records it as a BitGraph after the paper. The paper
 * digest the sheet names is the FUSED paper's: the bytes the slot spent.
 */
import { sha256 } from "@noble/hashes/sha256";
import { canonicalize } from "@mikeargento/bitgraph-verify";
import type { BitGraphProof } from "@mikeargento/bitgraph-verify";
import { extractAnswer } from "@mikeargento/exam-bank";
import { anchorFilesFor, b64, isPaper, paths, readBytes, readJson, record, writeAnchorFiles, writeBytes, writeJson, type Paper, type Transport } from "@mikeargento/exam-core";
import { providerById, type ProviderId, type Reply } from "./providers.js";

export const ANSWERS_VERSION = "exam-answers/1" as const;
export const RAW_VERSION = "exam-raw/1" as const;

/** Fixed for exam-bank/1; part of every request digest. */
export const SYSTEM_PROMPT = "You are sitting a written exam. Answer each question on its own. Follow the question's answer-format instructions exactly.";

export interface AnswerSheet {
  version: typeof ANSWERS_VERSION;
  paperDigestB64: string;
  model: { provider: ProviderId; id: string; reportedVersion: string | null };
  /** "carried": the raw/ files ship in the folder. "declared-not-carried": only their digests do. */
  raw: "carried" | "declared-not-carried";
  answers: Array<{ id: number; answer: string; rawDigestB64: string }>;
}

export interface RawExchange {
  version: typeof RAW_VERSION;
  id: number;
  family: string;
  provider: ProviderId;
  model: string;
  request: unknown;
  response: unknown;
  incomplete: boolean;
}

export interface AskOptions {
  root: string;
  provider: ProviderId;
  model: string;
  keepRaw: boolean;
  transport?: Transport;
  concurrency?: number;
  onEvent?: (e: AskEvent) => void;
}

export type AskEvent =
  | { kind: "asking"; total: number }
  | { kind: "answered"; id: number; done: number; total: number }
  | { kind: "sealing"; total: number }
  | { kind: "sealed"; proof: BitGraphProof };

export interface AskResult {
  sheet: AnswerSheet;
  sheetBytes: Uint8Array;
  proof: BitGraphProof;
  paper: Paper;
}

export function isAnswerSheet(x: unknown): x is AnswerSheet {
  if (x === null || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return s.version === ANSWERS_VERSION && typeof s.paperDigestB64 === "string" && typeof s.model === "object" && s.model !== null && Array.isArray(s.answers) && (s.raw === "carried" || s.raw === "declared-not-carried");
}

/** The raw file's bytes, exactly as written; its digest is what the sheet names. */
export function rawFileBytes(raw: RawExchange): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(raw, null, 2)}\n`);
}

export async function askAndSeal(o: AskOptions): Promise<AskResult> {
  const provider = providerById(o.provider);
  const paper = await readJson<Paper>(paths.paper.json(o.root));
  if (!isPaper(paper)) throw new Error(`no paper in ${o.root}; run \`exam paper\` first`);
  const fused = await readBytes(paths.paper.fused(o.root));
  const paperProof = await readJson<BitGraphProof>(paths.paper.proof(o.root));
  if (fused === null || paperProof === null) throw new Error(`the paper in ${o.root} is not sealed; run \`exam paper\` first`);
  const paperDigestB64 = b64(sha256(fused));
  if (paperProof.artifact?.digestB64 !== paperDigestB64) throw new Error("paper/new-file/paper.fused.json does not hash to paper/proof.json's digest; nothing asked");

  const total = paper.questions.length;
  o.onEvent?.({ kind: "asking", total });
  const replies = new Array<Reply | null>(total).fill(null);
  let next = 0;
  let done = 0;
  const width = Math.max(1, Math.min(o.concurrency ?? 4, total));
  await Promise.all(Array.from({ length: width }, async () => {
    while (next < total) {
      const i = next++;
      const q = paper.questions[i]!;
      replies[i] = await provider.ask(o.model, SYSTEM_PROMPT, q.prompt);
      o.onEvent?.({ kind: "answered", id: q.id, done: ++done, total });
    }
  }));

  const answers: AnswerSheet["answers"] = [];
  let reportedVersion: string | null = null;
  for (let i = 0; i < total; i++) {
    const q = paper.questions[i]!;
    const r = replies[i]!;
    reportedVersion ??= r.reportedVersion;
    const raw: RawExchange = { version: RAW_VERSION, id: q.id, family: q.family, provider: provider.id, model: o.model, request: r.request, response: r.response, incomplete: r.incomplete };
    const bytes = rawFileBytes(raw);
    if (o.keepRaw) await writeBytes(paths.raw.file(o.root, q.id), bytes);
    answers.push({ id: q.id, answer: extractAnswer(q.family, r.text), rawDigestB64: b64(sha256(bytes)) });
  }
  const sheet: AnswerSheet = { version: ANSWERS_VERSION, paperDigestB64, model: { provider: provider.id, id: o.model, reportedVersion }, raw: o.keepRaw ? "carried" : "declared-not-carried", answers };
  const sheetBytes = canonicalize(sheet as unknown as BitGraphProof);
  await writeBytes(paths.answers.json(o.root), sheetBytes);

  o.onEvent?.({ kind: "sealing", total });
  const proof = await record(o.transport ?? {}, sheetBytes);
  await writeJson(paths.answers.proof(o.root), proof);
  await writeAnchorFiles(paths.answers.anchors(o.root), await anchorFilesFor(o.transport ?? {}, proof));
  o.onEvent?.({ kind: "sealed", proof });
  return { sheet, sheetBytes, proof, paper };
}

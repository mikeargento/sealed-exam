// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * The paper, derived. Given the slot commitment and the bank, the same K
 * questions come out on every machine, in every language, forever. The
 * canonical answers come out of the same draw and are kept apart: they are
 * never in the paper and are re-derived at grading time.
 *
 * Draw order (fixed for exam-bank/1):
 *   rng = DrbgRng(seed)
 *   remaining[f] = bank.perFamily for each family, in bank order
 *   for q = 1..k:
 *     candidates = families with remaining > 0, in bank order
 *     family     = candidates[ int(rng, candidates.length) ]
 *     remaining[family] -= 1
 *     question   = family.generate(rng)        (draws from the same stream)
 */
import { FAMILIES, familyById, int, type Bank, type Family } from "@mikeargento/exam-bank";
import { canonicalize } from "@mikeargento/bitgraph-verify";
import type { BitGraphProof } from "@mikeargento/bitgraph-verify";
import { deriveSeed, DrbgRng } from "./seed.js";

export const PAPER_VERSION = "exam-paper/1" as const;

export interface PaperQuestion {
  id: number;
  family: string;
  prompt: string;
}

export interface Paper {
  version: typeof PAPER_VERSION;
  bankDigestB64: string;
  commitmentB64: string;
  k: number;
  questions: PaperQuestion[];
}

export interface DerivedPaper {
  paper: Paper;
  /** Canonical JSON bytes of the paper: what is fused and committed. */
  bytes: Uint8Array;
  /** The canonical answer per question, by index. Never written into the folder. */
  canonical: string[];
  families: Family[];
}

export const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");
export const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

/** The bank's families must be this code's families, in order, or the draw means nothing. */
export function familiesOf(bank: Bank): Family[] {
  const out: Family[] = [];
  for (let i = 0; i < bank.families.length; i++) {
    const declared = bank.families[i]!;
    const f = familyById(declared.id);
    if (f === undefined || FAMILIES[i]?.id !== declared.id) throw new Error(`bank family ${declared.id} at index ${i} is not this code's family there`);
    out.push(f);
  }
  return out;
}

export function derivePaper(commitment: Uint8Array, bank: Bank): DerivedPaper {
  const bankDigest = fromB64(bank.bankDigestB64);
  const rng = new DrbgRng(deriveSeed(commitment, bankDigest));
  const families = familiesOf(bank);
  const remaining = families.map(() => bank.perFamily);
  const questions: PaperQuestion[] = [];
  const canonical: string[] = [];
  for (let q = 1; q <= bank.k; q++) {
    const candidates = families.map((f, i) => ({ f, i })).filter((c) => remaining[c.i]! > 0);
    if (candidates.length === 0) throw new Error("bank: k exceeds perFamily × families");
    const chosen = candidates[int(rng, candidates.length)]!;
    remaining[chosen.i]!--;
    const question = chosen.f.generate(rng);
    questions.push({ id: q, family: chosen.f.id, prompt: question.prompt });
    canonical.push(question.canonical);
  }
  const paper: Paper = { version: PAPER_VERSION, bankDigestB64: bank.bankDigestB64, commitmentB64: b64(commitment), k: bank.k, questions };
  return { paper, bytes: canonicalize(paper as unknown as BitGraphProof), canonical, families };
}

export function isPaper(x: unknown): x is Paper {
  if (x === null || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return p.version === PAPER_VERSION && typeof p.bankDigestB64 === "string" && typeof p.commitmentB64 === "string" && typeof p.k === "number" && Array.isArray(p.questions);
}

// Copyright (c) Argento Computing Inc. Licensed under the MIT License. See LICENSE.

/** The verdict for a terminal: floors, score, the boundary. No durations, no "at". */
import { blockName, formatUtc } from "@mikeargento/exam-core";
import type { ExamVerdict, FloorReport } from "./verify.js";

/** "not before Base block N (header time T)"; an Ethereum floor (papers before 2026-10-07) is "Ethereum block N". */
export function floorPhrase(f: FloorReport | null): string {
  if (f === null) return "no floor in hand";
  const block = blockName(f.blockNumber, f.chain ?? "ethereum");
  if (f.time !== null) return `not before ${block} (header time ${formatUtc(f.time)})`;
  return f.timeWithheld !== undefined ? `not before ${block} (header time withheld: stamped after the attestation)` : `not before ${block} (header time not in hand)`;
}

export function renderText(v: ExamVerdict): string {
  const out: string[] = [];
  out.push(v.verdict === "ACCEPT" ? "ACCEPT" : v.verdict === "REJECT" ? "REJECT" : "NO-EVIDENCE");
  if (v.reason) out.push(v.reason);
  if (v.score) out.push(`Score ${v.score.correct}/${v.score.k}`);
  for (const f of v.families) out.push(`  ${f.title}: ${f.correct}/${f.total}`);
  if (v.paper) out.push(`Paper: position ${v.paper.counter}, ${floorPhrase(v.paper.floor)}`);
  if (v.answers) out.push(`Answers: position ${v.answers.counter}, ${floorPhrase(v.answers.floor)}`);
  if (v.model) out.push(`Model: ${v.model.provider} ${v.model.id}${v.model.reportedVersion && v.model.reportedVersion !== v.model.id ? ` (reported ${v.model.reportedVersion})` : ""}`);
  out.push("");
  for (const l of v.lines) out.push(`  [${l.state}] step ${l.step} ${l.name}: ${l.detail}`);
  for (const n of v.notes) out.push(`  note: ${n}`);
  out.push("");
  if (v.claim.sentence) out.push(v.claim.sentence);
  out.push(v.claim.proves);
  out.push(v.claim.doesNotProve);
  out.push(v.claim.footer);
  return `${out.join("\n")}\n`;
}

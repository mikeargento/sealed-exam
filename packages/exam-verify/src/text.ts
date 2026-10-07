// Copyright (c) Argento Computing Inc. Licensed under the MIT License. See LICENSE.

/** The verdict for a terminal: the two BitGraphs (floor, recorded, ceiling), score, the boundary. No durations. */
import { blockName, formatUtc } from "@mikeargento/exam-core";
import type { ExamVerdict, FloorReport, PositionReport } from "./verify.js";

/** "not before Base block N (header time T)"; an Ethereum floor (papers before 2026-10-07) is "Ethereum block N". */
export function floorPhrase(f: FloorReport | null): string {
  if (f === null) return "no floor in hand";
  const block = blockName(f.blockNumber, f.chain ?? "ethereum");
  if (f.time !== null) return `not before ${block} (header time ${formatUtc(f.time)})`;
  return f.timeWithheld !== undefined ? `not before ${block} (header time withheld: stamped after the attestation)` : `not before ${block} (header time not in hand)`;
}

/** One BitGraph as its proof page reads: the name and link, then floor, recorded, ceiling. */
export function bitgraphLines(label: string, p: PositionReport): string[] {
  const out = [`${label}: ${p.bitgraph}  ${p.proofUrl}`];
  out.push(`  floor     ${floorPhrase(p.floor)}`);
  out.push(`  recorded  ${p.recordedAtMs !== null ? `${formatUtc(Math.floor(p.recordedAtMs / 1000))} (the AWS Nitro attestation's time)` : "no validated attestation time"}`);
  out.push(`  ceiling   ${p.ceiling !== null ? `existed by ${blockName(p.ceiling.blockNumber, "base")} (header time ${formatUtc(p.ceiling.time)})` : "not in this folder"}`);
  return out;
}

export function renderText(v: ExamVerdict): string {
  const out: string[] = [];
  out.push(v.verdict === "ACCEPT" ? "ACCEPT" : v.verdict === "REJECT" ? "REJECT" : "NO-EVIDENCE");
  if (v.reason) out.push(v.reason);
  if (v.score) out.push(`Score ${v.score.correct}/${v.score.k}`);
  for (const f of v.families) out.push(`  ${f.title}: ${f.correct}/${f.total}`);
  if (v.claim.sentence) out.push(v.claim.sentence);
  if (v.claim.began) out.push(v.claim.began);
  if (v.paper) out.push(...bitgraphLines("Paper", v.paper));
  if (v.answers) out.push(...bitgraphLines("Answers", v.answers));
  if (v.model) out.push(`Model: ${v.model.provider} ${v.model.id}${v.model.reportedVersion && v.model.reportedVersion !== v.model.id ? ` (reported ${v.model.reportedVersion})` : ""}`);
  out.push("");
  for (const l of v.lines) out.push(`  [${l.state}] step ${l.step} ${l.name}: ${l.detail}`);
  for (const n of v.notes) out.push(`  note: ${n}`);
  out.push("");
  out.push(v.claim.proves);
  out.push(v.claim.doesNotProve);
  out.push(v.claim.footer);
  return `${out.join("\n")}\n`;
}

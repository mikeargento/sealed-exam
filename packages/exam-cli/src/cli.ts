#!/usr/bin/env node
// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * exam: the sealed exam, as a command.
 *
 *   exam open      [--name n]                       a held position; prints its floor
 *   exam paper     [--name n]                       derives the paper from the position and seals it (opens one if none is held)
 *   exam ask       --provider p --model m [--name n] [--no-raw]
 *   exam grade     [--name n]                       the score, by the verifier's own step 4
 *   exam export    <name>                           completes <name>.exam/ (bank, anchors, README)
 *   exam verify    <folder> [--json]                offline; writes verdict.json and report.html beside the files
 *   exam selftest
 *   exam run       --provider p --model m --name n  open → paper → ask → grade → export → verify → report
 *   exam record-bank                                one-time: records bank.json and ships its proof with the bank
 *
 * Prints for humans: positions and floors. Never a duration, never "at".
 * Exit codes: 0 ACCEPT, 1 REJECT, 2 NO-EVIDENCE, 3 error, 64 usage.
 */
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { generatorSourceTar, loadBank, packageRoot as bankRoot } from "@mikeargento/exam-bank";
import { PROVIDERS, askAndSeal, type ProviderId } from "@mikeargento/exam-ask";
import {
  CLAIM, allocate, anchorFilesFor, blockTimeFromHeader, floorOfSlot, formatUtc, fusePaper, isSlotRecord, paths, readBytes, readJson, record, remove, signedFloorOf, writeAnchorFiles, writeBytes, writeJson,
  type Transport,
} from "@mikeargento/exam-core";
import type { BitGraphProof, SlotAllocation } from "@mikeargento/bitgraph-verify";
import { renderReport, renderText, verifyExam, floorPhrase, type ExamVerdict } from "@mikeargento/exam-verify";
import { selftest } from "./selftest.js";

const USAGE = `exam: the sealed exam

  exam open      [--name n]
  exam paper     [--name n]
  exam ask       --provider anthropic|openai|google|openrouter --model <id> [--name n] [--no-raw]
  exam grade     [--name n]
  exam export    <name>
  exam verify    <folder> [--json]
  exam selftest
  exam run       --provider p --model m --name n [--no-raw] [--json]
  exam record-bank

Options: --name (default exam-run) names <name>.exam/; --base-url overrides https://bitgraph.ing; --json prints the verdict object.
Exit codes: 0 ACCEPT, 1 REJECT, 2 NO-EVIDENCE, 3 error, 64 usage.
`;

interface Args { command: string; positional: string[]; flags: Map<string, string | true> }

function parseArgs(argv: string[]): Args {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const boolean = new Set(["json", "no-raw", "help"]);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (!boolean.has(key) && next !== undefined && !next.startsWith("--")) { flags.set(key, next); i++; } else flags.set(key, true);
    } else positional.push(a);
  }
  return { command, positional, flags };
}

const str = (flags: Map<string, string | true>, k: string): string | undefined => { const v = flags.get(k); return typeof v === "string" ? v : undefined; };
const say = (line: string) => process.stdout.write(`${line}\n`);

function transportOf(flags: Map<string, string | true>): Transport {
  const t: Transport = {};
  const base = str(flags, "base-url");
  if (base) t.baseUrl = base;
  const key = process.env.BITGRAPH_API_KEY;
  if (key) t.apiKey = key;
  return t;
}

const floorText = (blockNumber: number, time: number | null) => time === null ? `block ${blockNumber}, header time not in hand` : `block ${blockNumber}, ${formatUtc(time)}`;

// ── open ────────────────────────────────────────────────────────────────────

async function open(root: string, t: Transport): Promise<SlotAllocation> {
  const slot = await allocate(t);
  await mkdir(root, { recursive: true });
  await writeJson(paths.slot(root), slot);
  const floor = await floorOfSlot(t, slot);
  say(`Opened position ${slot.counter}. Floor: ${floor ? floorText(floor.blockNumber, floor.time) : "not yet readable from the ledger; the sealed paper will carry it"}.`);
  return slot;
}

async function heldSlot(root: string): Promise<SlotAllocation | null> {
  const s = await readJson<unknown>(paths.slot(root));
  return isSlotRecord(s) ? s : null;
}

// ── paper ───────────────────────────────────────────────────────────────────

async function paper(root: string, t: Transport): Promise<BitGraphProof> {
  const slot = (await heldSlot(root)) ?? (await open(root, t));
  const bank = await loadBank();
  const fused = await fusePaper(t, slot, bank);
  await writeBytes(paths.paper.json(root), fused.bytes);
  await writeBytes(paths.paper.fused(root), fused.fusedBytes);
  await writeJson(paths.paper.proof(root), fused.proof);
  await remove(paths.slot(root));
  const anchors = await anchorFilesFor(t, fused.proof);
  await writeAnchorFiles(paths.paper.anchors(root), anchors);
  const floor = signedFloorOf(fused.proof);
  const witnessBlock = anchors.before.witness?.blockNumber;
  const time = anchors.before.witness && floor && witnessBlock === floor.blockNumber ? blockTimeFromHeader(String(anchors.before.witness.headerRlpHex)) : null;
  say(`Wrote ${fused.paper.k} questions from that position and sealed them at position ${fused.proof.commit.counter}.${floor ? ` Floor: ${floorText(floor.blockNumber, time)}.` : ""}`);
  return fused.proof;
}

// ── ask ─────────────────────────────────────────────────────────────────────

async function ask(root: string, t: Transport, provider: ProviderId, model: string, keepRaw: boolean): Promise<BitGraphProof> {
  const r = await askAndSeal({
    root, provider, model, keepRaw, transport: t,
    onEvent: (e) => {
      if (e.kind === "sealing") say(`Asked ${model}. ${e.total} answers back.`);
      if (e.kind === "sealed") {
        const floor = signedFloorOf(e.proof);
        say(`Sealed the answers at position ${e.proof.commit.counter}.${floor ? ` Floor: block ${floor.blockNumber}.` : ""}`);
      }
    },
  });
  return r.proof;
}

// ── export ──────────────────────────────────────────────────────────────────

async function exportFolder(root: string, t: Transport): Promise<void> {
  const bank = await loadBank();
  const tar = await generatorSourceTar();
  await writeJson(paths.bank.json(root), bank);
  await writeBytes(paths.bank.tar(root), tar);
  const bankProofDir = join(bankRoot(), "proof");
  const bankProof = await readJson<BitGraphProof>(join(bankProofDir, "proof.json"));
  if (bankProof !== null) {
    await writeJson(paths.bank.proof(root), bankProof);
    const anchorsDir = join(bankProofDir, "ethereum-anchors");
    try {
      for (const name of await readdir(anchorsDir)) await copyFile(join(anchorsDir, name), join(await ensureDir(paths.bank.anchors(root)), name));
    } catch { /* no anchors shipped with the bank proof */ }
  }
  for (const unit of ["paper", "answers"] as const) {
    const proof = await readJson<BitGraphProof>(paths[unit].proof(root));
    if (proof === null) continue;
    await writeAnchorFiles(paths[unit].anchors(root), await anchorFilesFor(t, proof));
  }
  const paperProof = await readJson<BitGraphProof>(paths.paper.proof(root));
  const answersProof = await readJson<BitGraphProof>(paths.answers.proof(root));
  const pf = paperProof ? signedFloorOf(paperProof) : null;
  const af = answersProof ? signedFloorOf(answersProof) : null;
  const readme = [
    "The sealed exam",
    "",
    pf ? CLAIM.sentence(pf.blockNumber) : "The paper's proof is not in this folder yet.",
    "",
    `Paper: position ${paperProof?.commit.counter ?? "?"}, not before block ${pf?.blockNumber ?? "?"}.`,
    `Answers: position ${answersProof?.commit.counter ?? "?"}, not before block ${af?.blockNumber ?? "?"}.`,
    "",
    CLAIM.proves,
    "",
    CLAIM.doesNotProve,
    "",
    "What is here:",
    "  bank/      bank.json (the public item bank, recorded once as a BitGraph: proof.json), generator.tar (its generator source)",
    "  paper/     paper.json (the questions), new-file/paper.fused.json (the committed bytes: paper.json + a 48-byte trailer carrying the slot commitment), proof.json, ethereum-anchors/",
    "  answers/   answers.json (the model's answers, naming the fused paper by digest), proof.json, ethereum-anchors/",
    "  raw/       one file per question: the request sent and the reply received, verbatim",
    "",
    "To check it, offline: `node verifier/exam.mjs verify <this folder>` from the package this came in, or `exam verify <this folder>` from @mikeargento/exam-cli (the tarballs in packages/). Or drop the folder on bitgraph.ing.",
    "Spec: @mikeargento/exam-core SPEC.md.",
  ].join("\n");
  await writeBytes(paths.readme(root), `${readme}\n`);
}

async function ensureDir(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  return dir;
}

// ── verify ──────────────────────────────────────────────────────────────────

async function verify(root: string, json: boolean): Promise<ExamVerdict> {
  const v = await verifyExam(root);
  await writeJson(paths.verdict(root), v);
  await writeBytes(paths.report(root), renderReport(v));
  process.stdout.write(json ? `${JSON.stringify(v, null, 2)}\n` : renderText(v));
  return v;
}

// ── record-bank ─────────────────────────────────────────────────────────────

async function recordBank(t: Transport): Promise<void> {
  const root = bankRoot();
  const bytes = await readBytes(join(root, "bank.json"));
  if (bytes === null) throw new Error("bank.json is missing; run `npm run bank` in packages/exam-bank");
  const proof = await record(t, bytes);
  await writeJson(join(root, "proof", "proof.json"), proof);
  await writeAnchorFiles(join(root, "proof", "ethereum-anchors"), await anchorFilesFor(t, proof));
  const floor = signedFloorOf(proof);
  say(`Recorded the bank at position ${proof.commit.counter}.${floor ? ` Floor: block ${floor.blockNumber}.` : ""} Proof written to ${relative(process.cwd(), join(root, "proof"))}.`);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const t = transportOf(args.flags);
  const name = str(args.flags, "name") ?? "exam-run";
  const json = args.flags.get("json") === true;
  switch (args.command) {
    case "open": { await open(paths.root(name), t); return 0; }
    case "paper": { await paper(paths.root(name), t); return 0; }
    case "ask": {
      const provider = str(args.flags, "provider");
      const model = str(args.flags, "model");
      if (!provider || !model || !PROVIDERS.includes(provider as ProviderId)) { process.stderr.write(USAGE); return 64; }
      await ask(paths.root(name), t, provider as ProviderId, model, args.flags.get("no-raw") !== true);
      return 0;
    }
    case "grade": {
      const v = await verifyExam(paths.root(name));
      if (v.score === null) { say(`No score: ${v.reason ?? "the folder could not be graded"}.`); return v.exitCode; }
      say(`Score ${v.score.correct}/${v.score.k}.`);
      for (const f of v.families) say(`  ${f.title}: ${f.correct}/${f.total}`);
      return 0;
    }
    case "export": {
      const target = args.positional[0] ?? name;
      const root = paths.root(target);
      await exportFolder(root, t);
      say(`Folder ready: ${relative(process.cwd(), root)}`);
      return 0;
    }
    case "verify": {
      const folder = args.positional[0];
      if (!folder) { process.stderr.write(USAGE); return 64; }
      const root = paths.root(folder);
      if (!(await stat(root).then((s) => s.isDirectory()).catch(() => false))) { process.stderr.write(`error: no folder at ${root}\n`); return 3; }
      const v = await verify(root, json);
      return v.exitCode;
    }
    case "selftest": { return await selftest(); }
    case "record-bank": { await recordBank(t); return 0; }
    case "run": {
      const provider = str(args.flags, "provider");
      const model = str(args.flags, "model");
      if (!provider || !model || !PROVIDERS.includes(provider as ProviderId)) { process.stderr.write(USAGE); return 64; }
      const root = paths.root(name);
      await paper(root, t);
      await ask(root, t, provider as ProviderId, model, args.flags.get("no-raw") !== true);
      await exportFolder(root, t);
      const v = await verifyExam(root);
      await writeJson(paths.verdict(root), v);
      await writeBytes(paths.report(root), renderReport(v));
      if (json) process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
      else {
        say(`${v.verdict === "ACCEPT" ? "Verified" : v.verdict === "REJECT" ? "Contradiction" : "No evidence"}${v.reason ? `: ${v.reason}` : ""}`);
        if (v.score) say(`Score ${v.score.correct}/${v.score.k}. Report: ${relative(process.cwd(), paths.report(root))}`);
        if (v.paper?.floor) say(`Paper ${floorPhrase(v.paper.floor)}.`);
        if (v.answers?.floor) say(`Answers ${floorPhrase(v.answers.floor)}.`);
      }
      if (process.platform === "darwin" && !json && !process.env.EXAM_NO_OPEN) spawn("open", [paths.report(root)], { detached: true, stdio: "ignore" }).unref();
      return v.exitCode;
    }
    default:
      process.stderr.write(USAGE);
      return args.command === "" || args.command === "--help" || args.command === "help" ? 0 : 64;
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (err: unknown) => {
    const e = err as { code?: string; message?: string };
    process.stderr.write(`error: ${e?.message ?? String(err)}\n`);
    process.exitCode = 3;
  },
);


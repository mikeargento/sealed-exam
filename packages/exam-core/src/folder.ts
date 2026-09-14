// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * The run folder, `<name>.exam/`. Three export units in the shape the
 * bitgraph.ing drop zone already reads (a directory holding proof.json, the
 * artifact beside it, a fused recording's new bytes under new-file/, anchors
 * under ethereum-anchors/), plus the raw replies and a README.
 *
 *   bank/      bank.json (recorded), generator.tar, proof.json, ethereum-anchors/
 *   paper/     paper.json (the origin), new-file/paper.fused.json (committed), proof.json, ethereum-anchors/
 *   answers/   answers.json (committed), proof.json, ethereum-anchors/
 *   raw/       q01.json … one file per question, digests named in answers.json
 *   README.txt the claim boundary and the two floors
 *   slot.json  a held, unspent position; deleted the moment it is spent
 */
import { statSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const FOLDER_SUFFIX = ".exam";
export const ANCHOR_DIR = "ethereum-anchors";

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

export const paths = {
  /** `<name>.exam`, or the path itself when it names a directory that already exists (a fixture, a folder someone was handed). */
  root: (name: string): string => (name.endsWith(FOLDER_SUFFIX) || isDir(name) ? resolve(name) : resolve(`${name}${FOLDER_SUFFIX}`)),
  readme: (root: string) => join(root, "README.txt"),
  slot: (root: string) => join(root, "slot.json"),
  report: (root: string) => join(root, "report.html"),
  verdict: (root: string) => join(root, "verdict.json"),
  bank: {
    dir: (root: string) => join(root, "bank"),
    json: (root: string) => join(root, "bank", "bank.json"),
    tar: (root: string) => join(root, "bank", "generator.tar"),
    proof: (root: string) => join(root, "bank", "proof.json"),
    anchors: (root: string) => join(root, "bank", ANCHOR_DIR),
  },
  paper: {
    dir: (root: string) => join(root, "paper"),
    json: (root: string) => join(root, "paper", "paper.json"),
    fused: (root: string) => join(root, "paper", "new-file", "paper.fused.json"),
    proof: (root: string) => join(root, "paper", "proof.json"),
    anchors: (root: string) => join(root, "paper", ANCHOR_DIR),
  },
  answers: {
    dir: (root: string) => join(root, "answers"),
    json: (root: string) => join(root, "answers", "answers.json"),
    proof: (root: string) => join(root, "answers", "proof.json"),
    anchors: (root: string) => join(root, "answers", ANCHOR_DIR),
  },
  raw: {
    dir: (root: string) => join(root, "raw"),
    file: (root: string, id: number) => join(root, "raw", `q${String(id).padStart(2, "0")}.json`),
  },
} as const;

export async function writeBytes(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeBytes(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readBytes(path: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    return null;
  }
}

export async function readJson<T = unknown>(path: string): Promise<T | null> {
  const bytes = await readBytes(path);
  if (bytes === null) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export async function remove(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}

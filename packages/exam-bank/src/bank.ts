// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * The bank as a document, and its digest.
 *
 *   bank.json = { version, k, perFamily, families[], generatorTarDigestB64, bankDigestB64 }
 *   bankDigest = SHA-256( canonicalize(bank without bankDigestB64) )
 *
 * `generatorTarDigestB64` is SHA-256 of a deterministic ustar archive of this
 * package's `src/**.ts` (sorted paths, mtime 0, uid/gid 0, mode 0644), so
 * the digest covers the code that generates and checks, not only the
 * parameter table. The exam paper commits to bankDigestB64; a verifier
 * recomputes both from the files shipped in the folder and from its own
 * source, and refuses to grade if they disagree.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha256";
import { canonicalize } from "@mikeargento/bitgraph-verify";
import type { BitGraphProof } from "@mikeargento/bitgraph-verify";
import { FAMILIES } from "./families.js";

export const BANK_VERSION = "exam-bank/1" as const;
export const K = 20;
export const PER_FAMILY = 4;

export interface BankFamily {
  id: string;
  title: string;
  params: Record<string, unknown>;
  answerFormat: string;
}

export interface Bank {
  version: typeof BANK_VERSION;
  k: number;
  perFamily: number;
  families: BankFamily[];
  generatorTarDigestB64: string;
  bankDigestB64: string;
}

export const toB64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");

/** This package's root, whether running from dist/ or src/. */
export function packageRoot(): string {
  return join(fileURLToPath(new URL("./", import.meta.url)), "..");
}

// ---------------------------------------------------------------------------
// Deterministic ustar (paths under 100 bytes, regular files only)
// ---------------------------------------------------------------------------

const BLOCK = 512;

function octal(value: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  const text = value.toString(8).padStart(length - 1, "0");
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

function header(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  const enc = new TextEncoder();
  const name = enc.encode(path);
  if (name.length > 100) throw new Error(`tar: path over 100 bytes: ${path}`);
  block.set(name, 0);
  block.set(octal(0o644, 8), 100);
  block.set(octal(0, 8), 108);
  block.set(octal(0, 8), 116);
  block.set(octal(size, 12), 124);
  block.set(octal(0, 12), 136);
  for (let i = 148; i < 156; i++) block[i] = 0x20;
  block[156] = 0x30; // '0': regular file
  block.set(enc.encode("ustar"), 257);
  block.set(enc.encode("00"), 263);
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += block[i] as number;
  block.set(enc.encode(sum.toString(8).padStart(6, "0")), 148);
  block[154] = 0;
  block[155] = 0x20;
  return block;
}

export function writeTar(files: ReadonlyArray<{ path: string; content: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const f of files) {
    parts.push(header(f.path, f.content.length));
    const padded = new Uint8Array(Math.ceil(f.content.length / BLOCK) * BLOCK);
    padded.set(f.content, 0);
    parts.push(padded);
  }
  parts.push(new Uint8Array(BLOCK), new Uint8Array(BLOCK));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Every entry of a tar written by writeTar, in order. */
export function readTar(bytes: Uint8Array): Array<{ path: string; content: Uint8Array }> {
  const out: Array<{ path: string; content: Uint8Array }> = [];
  let at = 0;
  const dec = new TextDecoder();
  while (at + BLOCK <= bytes.length) {
    const block = bytes.subarray(at, at + BLOCK);
    if (block.every((b) => b === 0)) break;
    const nameEnd = block.indexOf(0);
    const path = dec.decode(block.subarray(0, nameEnd < 0 ? 100 : nameEnd));
    const size = parseInt(dec.decode(block.subarray(124, 135)).replace(/\0.*$/, ""), 8);
    const content = bytes.subarray(at + BLOCK, at + BLOCK + size);
    out.push({ path, content });
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return out;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      out.push(...(await walk(p)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** The generator source archive: this package's src/**.ts, sorted by path. */
export async function generatorSourceTar(root: string = packageRoot()): Promise<Uint8Array> {
  const srcDir = join(root, "src");
  const files = (await walk(srcDir)).map((abs) => ({ abs, path: `src/${relative(srcDir, abs).split(sep).join("/")}` }));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const entries: Array<{ path: string; content: Uint8Array }> = [];
  for (const f of files) entries.push({ path: f.path, content: new Uint8Array(await readFile(f.abs)) });
  return writeTar(entries);
}

export function computeBankDigest(bank: Omit<Bank, "bankDigestB64"> | Bank): string {
  const { bankDigestB64: _drop, ...rest } = bank as Bank;
  void _drop;
  return toB64(sha256(canonicalize(rest as unknown as BitGraphProof)));
}

/** The bank this code IS, with the digest of the given source archive. */
export function buildBank(generatorTar: Uint8Array): Bank {
  const families: BankFamily[] = FAMILIES.map((f) => ({ id: f.id, title: f.title, params: f.params, answerFormat: f.answerFormat }));
  const partial = { version: BANK_VERSION, k: K, perFamily: PER_FAMILY, families, generatorTarDigestB64: toB64(sha256(generatorTar)) };
  return { ...partial, bankDigestB64: computeBankDigest(partial) };
}

/** bank.json as shipped beside this package. */
export async function loadBank(root: string = packageRoot()): Promise<Bank> {
  return JSON.parse(await readFile(join(root, "bank.json"), "utf8")) as Bank;
}

export function isBank(x: unknown): x is Bank {
  if (x === null || typeof x !== "object") return false;
  const b = x as Record<string, unknown>;
  return b.version === BANK_VERSION && typeof b.k === "number" && typeof b.perFamily === "number" && Array.isArray(b.families) && typeof b.generatorTarDigestB64 === "string" && typeof b.bankDigestB64 === "string";
}

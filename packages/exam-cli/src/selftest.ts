// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * `exam selftest`: the fixtures under fixtures/, each with its expected
 * verdict in its README, plus the DRBG vectors, a determinism pass, and the
 * sandbox fences. Prints "N self-tests passed" in the TRACE demo's style
 * and fails loudly on the first that does not.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha256";
import { FAMILIES, loadBank } from "@mikeargento/exam-bank";
import { HmacDrbg, derivePaper } from "@mikeargento/exam-core";
import { verifyExam } from "@mikeargento/exam-verify";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function fixturesDir(): string {
  return join(fileURLToPath(new URL("./", import.meta.url)), "..", "fixtures");
}

export async function selftest(): Promise<number> {
  let n = 0;
  const ok = (what: string) => { n++; process.stdout.write(`  ok ${n}: ${what}\n`); };
  const fail = (what: string): number => { process.stdout.write(`  FAILED: ${what}\n`); return 3; };

  // DRBG vectors (SPEC.md section 3)
  {
    const seed = new Uint8Array(32).map((_, i) => i);
    const d = new HmacDrbg(seed);
    if (hex(d.generate(32)) !== "3226437dd9f98b17591aad731383303213439f64d029a5764e84e36256ddeb79") return fail("DRBG vector 1");
    if (hex(d.generate(4)) !== "68ddf0df") return fail("DRBG vector 2");
    if (hex(d.generate(48)) !== "8a3ac94197d7576989f911850eadca78d9f2542fbfd6d73f340260e38435315a86f2ed71db4a739f6c86a7c3ea4c9128") return fail("DRBG vector 3");
    ok("HMAC-DRBG SHA-256 reproduces the independent vectors");
  }
  // determinism, 100 papers twice
  {
    const bank = await loadBank();
    for (let i = 0; i < 100; i++) {
      const c = sha256(new TextEncoder().encode(`selftest:${i}`));
      const a = derivePaper(c, bank);
      const b = derivePaper(c, bank);
      if (Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes)) !== 0) return fail(`paper ${i} differs between two derivations`);
    }
    ok("100 papers derived twice from fixed commitments are byte for byte the same");
  }
  // every family's canonical answer passes its own checker on a fresh instance
  {
    const bank = await loadBank();
    const d = derivePaper(sha256(new TextEncoder().encode("selftest:checkers")), bank);
    for (let i = 0; i < d.paper.questions.length; i++) {
      const q = d.paper.questions[i]!;
      const f = FAMILIES.find((x) => x.id === q.family)!;
      if (!(await f.check(f.display(d.canonical[i]!), d.canonical[i]!))) return fail(`${q.family} canonical answer fails its own checker`);
    }
    ok("every canonical answer passes its family's checker");
  }
  // the sandbox fences
  {
    const spec = FAMILIES.find((f) => f.id === "spec")!;
    const bank = await loadBank();
    const d = derivePaper(sha256(new TextEncoder().encode("selftest:sandbox")), bank);
    const i = d.paper.questions.findIndex((q) => q.family === "spec");
    if (await spec.check("function f(xs) { require('fs').readFileSync('/etc/hosts'); return 0 }", d.canonical[i]!)) return fail("sandbox let a function read the filesystem");
    if (await spec.check("function f(xs) { for(;;){} }", d.canonical[i]!)) return fail("sandbox did not stop a hang");
    ok("the sandbox refuses filesystem access and stops a hang");
  }
  // fixtures
  const dir = fixturesDir();
  let names: string[] = [];
  try { names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch { names = []; }
  for (const name of names) {
    const root = join(dir, name);
    let readme = "";
    try { readme = await readFile(join(root, "FIXTURE.txt"), "utf8"); } catch { return fail(`${name}: no FIXTURE.txt`); }
    const m = /Expected:\s*(ACCEPT|REJECT|NO-EVIDENCE)(?:\s*\((\w+)\))?/.exec(readme);
    if (!m) return fail(`${name}: FIXTURE.txt names no expected verdict`);
    const v = await verifyExam(root);
    if (v.verdict !== m[1]) return fail(`${name}: expected ${m[1]}, got ${v.verdict}${v.reason ? ` (${v.reason})` : ""}`);
    if (m[2] && v.disagreed !== m[2]) return fail(`${name}: expected disagreement "${m[2]}", got "${v.disagreed}"`);
    ok(`${name}: ${v.verdict}${v.disagreed ? ` (${v.disagreed})` : ""}${v.score ? `, score ${v.score.correct}/${v.score.k}` : ""} — ${readme.split("\n")[0]?.trim()}`);
  }
  process.stdout.write(`\n${n} self-tests passed\n`);
  return 0;
}

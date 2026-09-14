import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sha256 } from "@noble/hashes/sha256";
import { FAMILIES, buildBank, computeBankDigest, extractAnswer, generatorSourceTar, loadBank, packageRoot, readTar, type Rng } from "../index.js";

/** A test-only stream: SHA-256 counter mode over a label. Not the exam's DRBG. */
function testRng(label: string): Rng {
  let counter = 0;
  let buf: Uint8Array = new Uint8Array(0);
  let at = 0;
  return {
    u32() {
      if (at + 4 > buf.length) {
        buf = sha256(new TextEncoder().encode(`${label}:${counter++}`));
        at = 0;
      }
      const v = ((buf[at]! << 24) | (buf[at + 1]! << 16) | (buf[at + 2]! << 8) | buf[at + 3]!) >>> 0;
      at += 4;
      return v;
    },
  };
}

test("every family generates, and its canonical answer passes its own checker", async () => {
  for (const f of FAMILIES) {
    for (let i = 0; i < 20; i++) {
      const q = f.generate(testRng(`${f.id}:${i}`));
      assert.ok(q.prompt.length > 20, `${f.id}: prompt`);
      const shown = f.display(q.canonical);
      const asAnswer = f.id === "spec" ? "```js\n" + shown + "\n```" : `Some reasoning.\nANSWER: ${shown}`;
      assert.equal(await f.check(extractAnswer(f.id, asAnswer), q.canonical), true, `${f.id} #${i}: canonical must pass`);
    }
  }
});

test("wrong answers fail", async () => {
  for (const f of FAMILIES) {
    const q = f.generate(testRng(`${f.id}:wrong`));
    const wrong = f.id === "spec" ? "function f(xs) { return 424242; }" : f.id === "arith" ? "12345" : "Zed, Yak";
    assert.equal(await f.check(wrong, q.canonical), false, f.id);
  }
});

test("same stream, same question, byte for byte", () => {
  for (const f of FAMILIES) {
    const a = f.generate(testRng(`${f.id}:twice`));
    const b = f.generate(testRng(`${f.id}:twice`));
    assert.deepEqual(a, b, f.id);
  }
});

test("the answer extractor takes the last ANSWER line, and the last code block", () => {
  assert.equal(extractAnswer("arith", "ANSWER: 1\nno wait\nANSWER: 2"), "2");
  assert.equal(extractAnswer("order", "**ANSWER:** Elm, Fir"), "Elm, Fir");
  assert.equal(extractAnswer("logic", "just a line"), "just a line");
  assert.equal(extractAnswer("spec", "```js\nfunction f(xs){return 1}\n```\nthen\n```javascript\nfunction f(xs){return 2}\n```"), "function f(xs){return 2}");
});

test("the sandbox refuses a function that reaches for the filesystem, and survives a hang", async () => {
  const spec = FAMILIES.find((f) => f.id === "spec")!;
  const q = spec.generate(testRng("spec:sandbox"));
  assert.equal(await spec.check("function f(xs) { require('fs').readFileSync('/etc/passwd'); return 0; }", q.canonical), false);
  assert.equal(await spec.check("function f(xs) { for(;;){} }", q.canonical), false);
  assert.equal(await spec.check("function f(xs) { throw new Error('x') }", q.canonical), false);
});

test("no generator touches a clock or Math.random", () => {
  const src = join(packageRoot(), "src");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== "__tests__") walk(p); continue; }
      if (!p.endsWith(".ts")) continue;
      const text = readFileSync(p, "utf8");
      if (/Math\.random|Date\.now|new Date\(|performance\.now|crypto\.getRandomValues|randomBytes/.test(text)) offenders.push(p);
    }
  };
  walk(src);
  assert.deepEqual(offenders, []);
});

test("bank.json on disk is the bank this code is", async () => {
  const shipped = await loadBank();
  const tar = await generatorSourceTar();
  const built = buildBank(tar);
  assert.deepEqual(shipped, built, "run `npm run bank` in packages/exam-bank after changing src/");
  assert.equal(computeBankDigest(shipped), shipped.bankDigestB64);
  const entries = readTar(tar);
  assert.ok(entries.some((e) => e.path === "src/families/arith.ts"));
  assert.ok(entries.every((e) => !e.path.includes("__tests__")));
  const again = await generatorSourceTar();
  assert.deepEqual(Buffer.from(tar), Buffer.from(again));
});

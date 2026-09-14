// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Family 4: a small specification to a function. A filter, a map and a
 * reduction are drawn from parametric menus, the model writes JavaScript,
 * and the checker runs the code on five hidden test arrays in a permission-
 * restricted child process. The canonical answer is the bank's own reference
 * implementation, evaluated here in TypeScript, never through eval.
 */
import { type Family, type Question } from "../family.js";
import { between, int, pick, type Rng } from "../rng.js";
import { runSandboxed } from "../sandbox.js";

interface Step<T> { text: string; js: string; fn: T }

function drawFilter(rng: Rng): Step<(x: number, i: number) => boolean> {
  switch (int(rng, 8)) {
    case 0: { const t = between(rng, -10, 10); return { text: `Keep only the elements greater than ${t}.`, js: `xs.filter((x) => x > ${t})`, fn: (x) => x > t }; }
    case 1: { const t = between(rng, -10, 10); return { text: `Keep only the elements less than ${t}.`, js: `xs.filter((x) => x < ${t})`, fn: (x) => x < t }; }
    case 2: return { text: "Keep only the even elements (0 counts as even; negatives count by their value).", js: "xs.filter((x) => x % 2 === 0)", fn: (x) => x % 2 === 0 };
    case 3: return { text: "Keep only the odd elements.", js: "xs.filter((x) => x % 2 !== 0)", fn: (x) => x % 2 !== 0 };
    case 4: { const d = between(rng, 3, 5); return { text: `Keep only the elements divisible by ${d}.`, js: `xs.filter((x) => x % ${d} === 0)`, fn: (x) => x % d === 0 }; }
    case 5: return { text: "Keep only the elements at even indices (index 0, 2, 4, …).", js: "xs.filter((_, i) => i % 2 === 0)", fn: (_x, i) => i % 2 === 0 };
    case 6: return { text: "Keep only the elements at odd indices (index 1, 3, 5, …).", js: "xs.filter((_, i) => i % 2 === 1)", fn: (_x, i) => i % 2 === 1 };
    default: return { text: "Keep every element.", js: "xs.slice()", fn: () => true };
  }
}

function drawMap(rng: Rng): Step<(x: number) => number> {
  switch (int(rng, 4)) {
    case 0: {
      let a = between(rng, -3, 3);
      while (a === 0) a = between(rng, -3, 3);
      const b = between(rng, -9, 9);
      const expr = `${a} * x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
      return { text: `Replace each kept element x with ${expr}.`, js: `.map((x) => ${expr})`, fn: (x) => a * x + b };
    }
    case 1: return { text: "Replace each kept element x with x * x.", js: ".map((x) => x * x)", fn: (x) => x * x };
    case 2: return { text: "Replace each kept element with its absolute value.", js: ".map((x) => Math.abs(x))", fn: (x) => Math.abs(x) };
    default: return { text: "Leave the kept elements unchanged.", js: "", fn: (x) => x };
  }
}

function drawReduce(rng: Rng): Step<(ys: number[]) => number> {
  switch (int(rng, 5)) {
    case 0: return { text: "Return the sum of the resulting elements (0 if there are none).", js: "ys.reduce((s, y) => s + y, 0)", fn: (ys) => ys.reduce((s, y) => s + y, 0) };
    case 1: { const r = between(rng, -5, 5); return { text: `Return the largest resulting element, or ${r} if there are none.`, js: `ys.length ? Math.max(...ys) : ${r}`, fn: (ys) => (ys.length ? Math.max(...ys) : r) }; }
    case 2: { const r = between(rng, -5, 5); return { text: `Return the smallest resulting element, or ${r} if there are none.`, js: `ys.length ? Math.min(...ys) : ${r}`, fn: (ys) => (ys.length ? Math.min(...ys) : r) }; }
    case 3: return { text: "Return how many resulting elements there are.", js: "ys.length", fn: (ys) => ys.length };
    default: return { text: "Return the alternating sum of the resulting elements: the first minus the second plus the third minus the fourth, and so on (0 if there are none).", js: "ys.reduce((s, y, i) => (i % 2 === 0 ? s + y : s - y), 0)", fn: (ys) => ys.reduce((s, y, i) => (i % 2 === 0 ? s + y : s - y), 0) };
  }
}

interface Canonical { reference: string; tests: Array<{ input: number[]; expected: number }> }

/** The last fenced code block, or the whole text when there is none. */
export function extractCode(raw: string): string {
  const blocks = [...raw.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");
  const last = blocks.length > 0 ? blocks[blocks.length - 1]! : raw;
  return last.trim();
}

export const spec: Family = {
  id: "spec",
  title: "Specification to function",
  params: { language: "javascript", filters: 8, maps: 4, reductions: 5, hiddenTests: 5, testLength: [0, 8], testValues: [-20, 20] },
  answerFormat: "Reply with only the function, in a single ```js code block. Name it f, take one parameter xs, use no libraries, and write no import, require or export statements.",
  generate(rng: Rng): Question {
    const filter = drawFilter(rng);
    const map = drawMap(rng);
    const reduce = drawReduce(rng);
    const tests: Canonical["tests"] = [];
    for (let t = 0; t < 5; t++) {
      const len = t === 0 ? 0 : between(rng, 0, 8);
      const input: number[] = [];
      for (let i = 0; i < len; i++) input.push(between(rng, -20, 20));
      const ys = input.filter(filter.fn).map(map.fn);
      tests.push({ input, expected: reduce.fn(ys) });
    }
    const reference = `function f(xs) {\n  const ys = ${filter.js}${map.js};\n  return ${reduce.js};\n}`;
    const canonical: Canonical = { reference, tests };
    void pick;
    return {
      prompt: `Write a JavaScript function f(xs), where xs is an array of integers, that returns an integer computed as follows:\n\n1. ${filter.text}\n2. ${map.text}\n3. ${reduce.text}\n\n${this.answerFormat}`,
      canonical: JSON.stringify(canonical),
    };
  },
  async check(answer: string, canonical: string): Promise<boolean> {
    const c = JSON.parse(canonical) as Canonical;
    const code = extractCode(answer);
    if (code.length === 0 || code.length > 20_000) return false;
    const result = await runSandboxed(code, c.tests.map((t) => t.input));
    if (result === null || result.length !== c.tests.length) return false;
    return c.tests.every((t, i) => result[i] === t.expected);
  },
  display: (canonical) => (JSON.parse(canonical) as Canonical).reference,
};

// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Family 2: a seating puzzle. Four or five people in a row of numbered seats,
 * five to seven constraints drawn true of a secret arrangement, and the
 * arrangement is kept only when the solver finds exactly one. The draw is
 * repeated (deterministically) until it is unique.
 */
import { ANSWER_LINE, sameList, type Family, type Question } from "../family.js";
import { between, int, pick, shuffle, type Rng } from "../rng.js";

const NAMES = ["Ada", "Bram", "Cleo", "Dev", "Esme", "Fitz", "Gwen", "Hugo"] as const;
const MAX_DRAWS = 1000;

type Pos = Record<string, number>; // name -> seat, 1-based

interface Constraint {
  text: string;
  holds: (pos: Pos) => boolean;
}

function drawConstraint(rng: Rng, names: readonly string[], secret: Pos, n: number): Constraint {
  const a = pick(rng, names);
  let b = pick(rng, names);
  while (b === a) b = pick(rng, names);
  const pa = secret[a]!;
  const pb = secret[b]!;
  const kind = int(rng, 7);
  switch (kind) {
    case 0:
      return { text: `${a} sits in seat ${pa}.`, holds: (p) => p[a] === pa };
    case 1: {
      let k = between(rng, 1, n);
      while (k === pa) k = between(rng, 1, n);
      return { text: `${a} does not sit in seat ${k}.`, holds: (p) => p[a] !== k };
    }
    case 2:
      return pa < pb
        ? { text: `${a} sits somewhere to the left of ${b}.`, holds: (p) => p[a]! < p[b]! }
        : { text: `${b} sits somewhere to the left of ${a}.`, holds: (p) => p[b]! < p[a]! };
    case 3:
      if (Math.abs(pa - pb) === 1) {
        const [l, r] = pa < pb ? [a, b] : [b, a];
        return { text: `${l} sits immediately to the left of ${r}.`, holds: (p) => p[r]! === p[l]! + 1 };
      }
      return { text: `${a} and ${b} do not sit next to each other.`, holds: (p) => Math.abs(p[a]! - p[b]!) !== 1 };
    case 4:
      return Math.abs(pa - pb) === 1
        ? { text: `${a} and ${b} sit next to each other.`, holds: (p) => Math.abs(p[a]! - p[b]!) === 1 }
        : { text: `${a} and ${b} do not sit next to each other.`, holds: (p) => Math.abs(p[a]! - p[b]!) !== 1 };
    case 5:
      return pa === 1 || pa === n
        ? { text: `${a} sits at one end of the row.`, holds: (p) => p[a] === 1 || p[a] === n }
        : { text: `${a} does not sit at either end of the row.`, holds: (p) => p[a] !== 1 && p[a] !== n };
    default: {
      const d = Math.abs(pa - pb);
      return { text: `There are exactly ${d - 1} seat${d - 1 === 1 ? "" : "s"} between ${a} and ${b}.`, holds: (p) => Math.abs(p[a]! - p[b]!) === d };
    }
  }
}

function* permutations<T>(items: readonly T[]): Generator<T[]> {
  if (items.length <= 1) { yield items.slice(); return; }
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) yield [items[i] as T, ...p];
  }
}

function countSolutions(names: readonly string[], constraints: readonly Constraint[]): number {
  let count = 0;
  for (const order of permutations(names)) {
    const pos: Pos = {};
    order.forEach((name, i) => { pos[name] = i + 1; });
    if (constraints.every((c) => c.holds(pos))) count++;
    if (count > 1) return count;
  }
  return count;
}

export const logic: Family = {
  id: "logic",
  title: "Seating puzzle",
  params: { people: [4, 5], constraints: [5, 7], constraintKinds: 7, uniqueSolution: true, maxDraws: MAX_DRAWS },
  answerFormat: "Give the names in seat order from seat 1 to the last seat, separated by commas.",
  generate(rng: Rng): Question {
    const n = between(rng, 4, 5);
    const names = shuffle(rng, NAMES).slice(0, n);
    const secretOrder = shuffle(rng, names);
    const secret: Pos = {};
    secretOrder.forEach((name, i) => { secret[name] = i + 1; });
    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const k = between(rng, 5, 7);
      const constraints: Constraint[] = [];
      const seen = new Set<string>();
      let guard = 0;
      while (constraints.length < k && guard++ < 200) {
        const c = drawConstraint(rng, names, secret, n);
        if (seen.has(c.text)) continue;
        seen.add(c.text);
        constraints.push(c);
      }
      if (constraints.length < k) continue;
      if (countSolutions(names, constraints) !== 1) continue;
      const listed = names.join(", ");
      const lines = constraints.map((c, i) => `${i + 1}. ${c.text}`).join("\n");
      return {
        prompt: `${n} people (${listed}) sit in a row of ${n} seats numbered 1 to ${n} from left to right. All of the following are true:\n\n${lines}\n\nWho sits where?\n\n${this.answerFormat}\n${ANSWER_LINE}`,
        canonical: secretOrder.join(", "),
      };
    }
    throw new Error("logic: no unique puzzle in the draw budget");
  },
  async check(answer: string, canonical: string): Promise<boolean> {
    return sameList(answer, canonical);
  },
  display: (canonical) => canonical,
};

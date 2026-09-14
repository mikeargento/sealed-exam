// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Family 1: multi-step arithmetic. Operands of 6–9 digits, one of five fixed
 * shapes mixing +, - and *, an exact integer answer. Evaluated with BigInt;
 * the answer can be negative and can exceed 2^53, which is the point.
 */
import { ANSWER_LINE, unwrap, type Family, type Question } from "../family.js";
import { bigDigits, between, pick, type Rng } from "../rng.js";

const SHAPES: ReadonlyArray<{ render: (o: string[]) => string; eval: (o: bigint[]) => bigint; arity: number }> = [
  { arity: 4, render: (o) => `(${o[0]} + ${o[1]}) * ${o[2]} - ${o[3]}`, eval: (o) => (o[0]! + o[1]!) * o[2]! - o[3]! },
  { arity: 4, render: (o) => `${o[0]} * ${o[1]} - ${o[2]} * ${o[3]}`, eval: (o) => o[0]! * o[1]! - o[2]! * o[3]! },
  { arity: 4, render: (o) => `(${o[0]} - ${o[1]}) * (${o[2]} + ${o[3]})`, eval: (o) => (o[0]! - o[1]!) * (o[2]! + o[3]!) },
  { arity: 4, render: (o) => `${o[0]} * (${o[1]} + ${o[2]}) + ${o[3]}`, eval: (o) => o[0]! * (o[1]! + o[2]!) + o[3]! },
  { arity: 5, render: (o) => `${o[0]} * ${o[1]} + ${o[2]} * ${o[3]} - ${o[4]}`, eval: (o) => o[0]! * o[1]! + o[2]! * o[3]! - o[4]! },
];

export const arith: Family = {
  id: "arith",
  title: "Multi-step arithmetic",
  params: { operandDigits: [6, 9], operands: [4, 5], operators: ["+", "-", "*"], shapes: SHAPES.length },
  answerFormat: "Give the exact integer, with no thousands separators.",
  generate(rng: Rng): Question {
    const shape = pick(rng, SHAPES);
    const operands: bigint[] = [];
    for (let i = 0; i < shape.arity; i++) operands.push(bigDigits(rng, between(rng, 6, 9)));
    const expr = shape.render(operands.map(String));
    return {
      prompt: `Compute exactly:\n\n${expr}\n\n${this.answerFormat}\n${ANSWER_LINE}`,
      canonical: shape.eval(operands).toString(),
    };
  },
  async check(answer: string, canonical: string): Promise<boolean> {
    const s = unwrap(answer).replace(/[,_\s]/g, "").replace(/^\+/, "").replace(/^=+/, "");
    if (!/^-?\d+$/.test(s)) return false;
    return BigInt(s) === BigInt(canonical);
  },
  display: (canonical) => canonical,
};

// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Family 3: a string transformation pipeline. A random 12–20 character string
 * of letters and digits, three or four distinct operations applied in order,
 * and the answer is the resulting string, exactly.
 */
import { ANSWER_LINE, unwrap, type Family, type Question } from "../family.js";
import { between, int, pick, shuffle, type Rng } from "../rng.js";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

interface Op { text: string; apply: (s: string) => string }

const shiftLetter = (ch: string, k: number): string => {
  const c = ch.charCodeAt(0);
  if (c >= 97 && c <= 122) return String.fromCharCode(97 + ((c - 97 + k) % 26));
  if (c >= 65 && c <= 90) return String.fromCharCode(65 + ((c - 65 + k) % 26));
  return ch;
};

const KINDS: ReadonlyArray<(rng: Rng, current: string) => Op> = [
  () => ({ text: "Reverse the string.", apply: (s) => s.split("").reverse().join("") }),
  (rng, s) => {
    const k = between(rng, 1, Math.max(1, s.length - 1));
    return { text: `Rotate the string left by ${k}: move its first ${k} character${k === 1 ? "" : "s"} to the end, in the same order.`, apply: (t) => t.slice(k % t.length) + t.slice(0, k % t.length) };
  },
  () => ({ text: "Swap the case of every letter (lowercase becomes uppercase and uppercase becomes lowercase); leave digits unchanged.", apply: (s) => s.split("").map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join("") }),
  (rng) => {
    const k = between(rng, 1, 25);
    return { text: `Shift every letter forward by ${k} place${k === 1 ? "" : "s"} in the alphabet, wrapping from z back to a (and Z back to A); keep each letter's case; leave digits unchanged.`, apply: (s) => s.split("").map((c) => shiftLetter(c, k)).join("") };
  },
  (rng, s) => {
    const x = s.charAt(int(rng, s.length));
    let y = ALPHABET.charAt(int(rng, ALPHABET.length));
    while (y === x) y = ALPHABET.charAt(int(rng, ALPHABET.length));
    return { text: `Replace every occurrence of the character ${x} with ${y} (case-sensitive).`, apply: (t) => t.split(x).join(y) };
  },
  (rng) => {
    const n = between(rng, 2, 4);
    const ord = n === 2 ? "2nd" : n === 3 ? "3rd" : "4th";
    return { text: `Delete every ${ord} character (the ${ord}, ${2 * n}th, ${3 * n}th, … counting from 1).`, apply: (t) => t.split("").filter((_, i) => (i + 1) % n !== 0).join("") };
  },
  () => ({ text: "Keep only the characters at odd positions (the 1st, 3rd, 5th, …, counting from 1).", apply: (s) => s.split("").filter((_, i) => i % 2 === 0).join("") }),
  () => ({ text: "Sort the characters in ascending ASCII order (digits before uppercase letters before lowercase letters).", apply: (s) => s.split("").sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0)).join("") }),
];

export const strings: Family = {
  id: "strings",
  title: "String transformation",
  params: { length: [12, 20], alphabet: "a-z A-Z 0-9", steps: [3, 4], operationKinds: KINDS.length },
  answerFormat: "Give the final string exactly, and nothing else after ANSWER:.",
  generate(rng: Rng): Question {
    const len = between(rng, 12, 20);
    let s = "";
    for (let i = 0; i < len; i++) s += ALPHABET.charAt(int(rng, ALPHABET.length));
    const start = s;
    const steps = between(rng, 3, 4);
    const order = shuffle(rng, KINDS).slice(0, steps);
    const lines: string[] = [];
    for (const kind of order) {
      const op = kind(rng, s);
      lines.push(op.text);
      s = op.apply(s);
    }
    void pick;
    return {
      prompt: `Start with the string (between the brackets, without them): [${start}]\n\nApply these steps in order:\n\n${lines.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nWhat is the resulting string?\n\n${this.answerFormat}\n${ANSWER_LINE}`,
      canonical: s,
    };
  },
  async check(answer: string, canonical: string): Promise<boolean> {
    const a = unwrap(answer).replace(/^\[(.*)\]$/s, "$1");
    return a === canonical;
  },
  display: (canonical) => canonical,
};

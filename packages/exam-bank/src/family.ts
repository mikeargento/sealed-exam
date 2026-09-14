// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

import type { Rng } from "./rng.js";

/** One generated instance: what the model is shown and what settles it. */
export interface Question {
  prompt: string;
  /** Opaque to everyone but the family's own checker. Never in the paper. */
  canonical: string;
}

/**
 * A template family. The FORM is public (this file, the parameter ranges in
 * bank.json); the DIFFICULTY is in the instance, which nobody can draw before
 * the slot commitment exists.
 */
export interface Family {
  id: string;
  title: string;
  /** The parameter ranges, exactly as they go into bank.json. Documentation, not configuration: the code is the bank. */
  params: Record<string, unknown>;
  /** Appended to every prompt of this family; part of the committed paper. */
  answerFormat: string;
  generate(rng: Rng): Question;
  /** The extracted answer against the canonical one. Async because one family runs code. */
  check(answer: string, canonical: string): Promise<boolean>;
  /** What a reader is shown as "the canonical answer". */
  display(canonical: string): string;
}

/** The common tail of every non-code prompt. */
export const ANSWER_LINE = "Reason as much as you like, then finish with one final line of the form\nANSWER: <your answer>";

/** Strip the wrappers a model habitually puts around a short answer. */
export function unwrap(answer: string): string {
  let s = answer.trim();
  for (;;) {
    const before = s;
    s = s.replace(/^\*\*(.*)\*\*$/s, "$1").trim();
    s = s.replace(/^`(.*)`$/s, "$1").trim();
    s = s.replace(/^"(.*)"$/s, "$1").trim();
    s = s.replace(/^'(.*)'$/s, "$1").trim();
    s = s.replace(/[.。]+$/, "").trim();
    if (s === before) return s;
  }
}

/** Compare two comma-separated lists of labels, case-insensitively, ignoring separators. */
export function sameList(answer: string, canonical: string): boolean {
  const norm = (s: string) => unwrap(s).replace(/\band\b/gi, ",").replace(/[→>|;\n]/g, ",").split(",").map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0);
  const a = norm(answer);
  const b = norm(canonical);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

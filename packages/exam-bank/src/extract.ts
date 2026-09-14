// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * The model's answer, out of its raw reply. Every family but the code one
 * asks for a final `ANSWER: …` line; the last such line wins, and a reply
 * with none is judged by its last non-empty line. The code family takes the
 * last fenced block. Fixed per bank version: the extractor is part of what
 * "the model answered X" means, so it lives beside the checkers.
 */
import { extractCode } from "./families/spec.js";

export function extractAnswer(familyId: string, raw: string): string {
  if (familyId === "spec") return extractCode(raw);
  const lines = raw.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^\s*\**\s*ANSWER\s*\**\s*:\s*\**\s*(.*?)\s*\**\s*$/i.exec(lines[i] ?? "");
    if (m) return (m[1] ?? "").trim();
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = (lines[i] ?? "").trim();
    if (t.length > 0) return t;
  }
  return "";
}

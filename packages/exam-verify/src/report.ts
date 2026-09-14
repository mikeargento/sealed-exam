// Copyright (c) Argento Computing Inc. Licensed under the MIT License. See LICENSE.

/**
 * report.html: one self-contained page for everyone who is not a developer.
 * Inline CSS, no scripts required (the one expander is a <details>), reads
 * correctly with CSS off because the document order IS the reading order:
 * verdict, score, the sentence, the two floors, the model, the families, one
 * question, the claim boundary, the footer. Nothing else.
 *
 * Verified / Contradiction / No evidence never share a colour or a word.
 */
import { formatUtc } from "@mikeargento/exam-core";
import type { ExamVerdict, FloorReport } from "./verify.js";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EXPLORER = "https://etherscan.io/block/";

const CSS = `
:root { color-scheme: light; }
html { background: #fff; }
body { margin: 0; padding: 48px 24px 64px; color: #000; background: #fff; font: 17px/1.45 "acumin-pro", "Acumin Pro", -apple-system, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 720px; margin: 0 auto; }
h1 { font-size: 64px; line-height: 1; font-weight: 900; letter-spacing: -0.01em; margin: 0 0 24px; }
h1.contradiction { color: #e3181c; }
h1.noevidence { color: #000; font-weight: 400; }
.score { font-size: 40px; font-weight: 900; margin: 0 0 32px; }
p { margin: 0 0 18px; }
.sentence { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.sentence a { color: #e3181c; text-decoration: underline; }
.floor { margin: 0 0 6px; }
.floor b { font-weight: 700; }
.mono, code { font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 15px; }
.section { margin-top: 40px; }
h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin: 0 0 12px; border-top: 1px solid #000; padding-top: 10px; }
ul { list-style: none; padding: 0; margin: 0; }
li { padding: 6px 0; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; gap: 16px; }
li .mark { color: #e3181c; font-weight: 900; }
details { margin-top: 12px; }
summary { cursor: pointer; font-weight: 700; }
details pre { white-space: pre-wrap; background: #fff; border: 1px solid #000; padding: 12px; margin: 12px 0; font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 14px; }
.label { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin: 14px 0 4px; }
.claim { margin-top: 48px; border-top: 1px solid #000; padding-top: 16px; }
.footer { margin-top: 32px; font-size: 14px; }
.reason { font-size: 20px; margin-bottom: 28px; }
`;

function floorLine(label: string, f: FloorReport | null): string {
  if (f === null) return `<p class="floor"><b>${esc(label)}:</b> no floor in hand.</p>`;
  const when = f.time === null ? "header time not in hand" : `header time ${esc(formatUtc(f.time))}`;
  return `<p class="floor"><b>${esc(label)}:</b> block <a class="mono" href="${EXPLORER}${f.blockNumber}">${f.blockNumber}</a>, ${when}.</p>`;
}

export function renderReport(v: ExamVerdict): string {
  const word = v.verdict === "ACCEPT" ? "Verified" : v.verdict === "REJECT" ? "Contradiction" : "No evidence";
  const cls = v.verdict === "ACCEPT" ? "verified" : v.verdict === "REJECT" ? "contradiction" : "noevidence";
  const parts: string[] = [];
  parts.push(`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(word)} — sealed exam</title>`);
  parts.push(`<link rel="stylesheet" href="https://use.typekit.net/svq0oqy.css">`);
  parts.push(`<style>${CSS}</style></head><body><main>`);
  parts.push(`<h1 class="${cls}">${esc(word)}</h1>`);
  if (v.verdict === "REJECT" && v.reason) parts.push(`<p class="reason">${esc(v.reason)}</p>`);
  if (v.verdict === "NO-EVIDENCE" && v.reason) parts.push(`<p class="reason">${esc(v.reason)}</p>`);
  if (v.score) parts.push(`<p class="score">${v.score.correct}/${v.score.k}</p>`);
  if (v.claim.sentence && v.paper?.floor) {
    const f = v.paper.floor;
    parts.push(`<p class="sentence">These questions could not have existed before block <a href="${EXPLORER}${f.blockNumber}">${f.blockNumber}</a>.</p>`);
    parts.push(`<p>Not before ${f.time === null ? "the time in that block's header (not in hand here)" : esc(formatUtc(f.time))}.</p>`);
  }
  if (v.paper || v.answers) {
    parts.push(`<div class="section"><h2>Floors</h2>`);
    parts.push(floorLine("Paper not before", v.paper?.floor ?? null));
    parts.push(floorLine("Answers not before", v.answers?.floor ?? null));
    parts.push(`</div>`);
  }
  if (v.model) {
    parts.push(`<div class="section"><h2>Model</h2><p>${esc(v.model.provider)} · <span class="mono">${esc(v.model.id)}</span>${v.model.reportedVersion && v.model.reportedVersion !== v.model.id ? ` (reported as <span class="mono">${esc(v.model.reportedVersion)}</span>)` : ""}</p></div>`);
  }
  if (v.families.length > 0) {
    parts.push(`<div class="section"><h2>Per family</h2><ul>`);
    for (const f of v.families) {
      const wrong = f.total - f.correct;
      parts.push(`<li><span>${esc(f.title)}</span><span>${f.correct}/${f.total}${wrong > 0 ? ` <span class="mark" title="${wrong} wrong">✕${wrong > 1 ? ` ×${wrong}` : ""}</span>` : ""}</span></li>`);
    }
    parts.push(`</ul></div>`);
  }
  if (v.questions.length > 0) {
    const shown = v.questions.find((q) => q.family === "logic") ?? v.questions[0]!;
    parts.push(`<div class="section"><details><summary>Show a question</summary>`);
    parts.push(`<p class="label">Question ${shown.id} (${esc(shown.family)})</p><pre>${esc(shown.prompt)}</pre>`);
    parts.push(`<p class="label">The model's answer${shown.correct === false ? ' <span class="mark">✕ wrong</span>' : ""}</p><pre>${esc(shown.answer ?? "(no answer)")}</pre>`);
    parts.push(`<p class="label">The canonical answer</p><pre>${esc(shown.canonical)}</pre>`);
    parts.push(`</details></div>`);
  }
  if (v.notes.length > 0) parts.push(`<div class="section">${v.notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>`);
  parts.push(`<div class="claim"><p>${esc(v.claim.proves)}</p><p>${esc(v.claim.doesNotProve)}</p></div>`);
  parts.push(`<p class="footer">${esc(v.claim.footer)}</p>`);
  parts.push(`</main></body></html>\n`);
  return parts.join("\n");
}

#!/usr/bin/env node
/**
 * One table: every folder under demo/ and every fixture, verified offline
 * from its files, with the network nailed shut. Every value printed was
 * recomputed by this run; nothing is read from a verdict file.
 *
 *   node verifier/demo.mjs
 */
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const closed = (what) => () => { throw new Error(`the verifier tried to use the network (${what}); this package forbids it`); };
globalThis.fetch = closed("fetch");
net.Socket.prototype.connect = closed("net.connect");
tls.connect = closed("tls.connect");
http.request = closed("http.request");
https.request = closed("https.request");

const HERE = fileURLToPath(new URL("./", import.meta.url));

/* Where the five packages are. Two layouts, both named rather than
   searched for: in the release zip they are vendored under
   verifier/node_modules/, which is what makes that zip self-contained and
   is why it is checked first; in a clone of this repository npm links the
   workspaces into node_modules/ at the root, one level up. Tested with
   existsSync rather than caught from a failed import, so a genuine missing
   module inside a package still reports itself instead of being mistaken
   for the other layout. */
const home = (name) => {
  const here = join(HERE, "node_modules", "@mikeargento", name);
  const root = join(HERE, "..", "node_modules", "@mikeargento", name);
  if (existsSync(here)) return here;
  if (existsSync(root)) return root;
  throw new Error(`@mikeargento/${name} is not installed; run: npm install && npm run build`);
};

const { verifyExam } = await import(pathToFileURL(join(home("exam-verify"), "dist", "index.js")).href);
const { formatUtc } = await import(pathToFileURL(join(home("exam-core"), "dist", "index.js")).href);

const DEMO = join(HERE, "..", "demo");
const FIXTURES = join(home("exam-cli"), "fixtures");

/* A block and the time in its checked header: "52275957 02:47:41Z". The
   chain and the day are said once, below the table and in the section
   label, so the columns stay narrow enough to read. An Ethereum floor (a
   folder from before 2026-10-07) is marked "eth". */
const hms = (t) => formatUtc(t).replace(/^.* (\d\d:\d\d:\d\dZ)$/, "$1");
const block = (b) => (b === null ? "-" : `${b.chain === "ethereum" ? "eth " : ""}${b.blockNumber} ${b.time === null ? (b.timeWithheld ? "(withheld)" : "(no header)") : hms(b.time)}`);
const pad = (s, n) => String(s).padEnd(n);

async function rows(dir, label) {
  const names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const out = [];
  for (const name of names) {
    const v = await verifyExam(join(dir, name));
    let expected = "";
    try { expected = /Expected:\s*([A-Z-]+(?:\s*\(\w+\))?)/.exec(await readFile(join(dir, name, "FIXTURE.txt"), "utf8"))?.[1] ?? ""; } catch { expected = ""; }
    const ceiling = (c) => (c ? block({ chain: "base", blockNumber: c.blockNumber, time: c.time }) : "-");
    out.push({
      label, name: name.replace(/\.exam$/, ""), verdict: v.verdict + (v.disagreed ? ` (${v.disagreed})` : ""), expected, score: v.score ? `${v.score.correct}/${v.score.k}` : "-",
      paper: v.paper ? `#${v.paper.counter}` : "-", pfloor: block(v.paper?.floor ?? null), pceil: ceiling(v.paper?.ceiling ?? null),
      answers: v.answers ? `#${v.answers.counter}` : "-", afloor: block(v.answers?.floor ?? null), aceil: ceiling(v.answers?.ceiling ?? null),
      reason: v.reason ?? "",
    });
  }
  return out;
}

const all = [...(await rows(DEMO, "demo")), ...(await rows(FIXTURES, "fixture"))];
/* Columns wide enough for the longest value they hold, so nothing runs into the next column. */
const COLS = [["name", "folder"], ["verdict", "verdict"], ["score", "score"], ["paper", "paper"], ["pfloor", "floor"], ["pceil", "ceiling"], ["answers", "answers"], ["afloor", "floor"], ["aceil", "ceiling"]];
const W = Object.fromEntries(COLS.map(([k, h]) => [k, Math.max(h.length, ...all.map((r) => String(r[k]).length)) + 2]));
const line = (r) => `  ${COLS.map(([k]) => pad(r[k], W[k])).join("")}`;
console.log("");
console.log(line(Object.fromEntries(COLS)));
console.log(`  ${"-".repeat(Object.values(W).reduce((a, b) => a + b, 0))}`);
let section = "";
for (const r of all) {
  if (r.label !== section) { section = r.label; console.log(`  ${section === "demo" ? "demo/ (real runs, 7 October 2026)" : "fixtures (from @mikeargento/exam-cli)"}`); }
  console.log(line(r));
  if (r.expected && !r.verdict.startsWith(r.expected.split(" ")[0])) { console.log(`    !! expected ${r.expected}`); process.exitCode = 1; }
  if (r.reason) console.log(`    ${r.reason}`);
}
console.log("");
console.log("  Every value above was recomputed from the files, with fetch and sockets disabled in this process.");
console.log("  paper and answers: each BitGraph, by number. floor: not before this Base block (the time in its header).");
console.log("  ceiling: existed by this Base block (the time in its header). All times UTC.");
console.log("  -: not in the folder, or in the folder and failing its check; exam verify on the folder lists which.");
console.log("");

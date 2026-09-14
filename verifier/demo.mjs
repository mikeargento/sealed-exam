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

const floor = (f) => (f === null ? "-" : `${f.blockNumber} ${f.time === null ? "(no header)" : formatUtc(f.time)}`);
const pad = (s, n) => String(s).padEnd(n);

async function rows(dir, label) {
  const names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const out = [];
  for (const name of names) {
    const v = await verifyExam(join(dir, name));
    let expected = "";
    try { expected = /Expected:\s*([A-Z-]+(?:\s*\(\w+\))?)/.exec(await readFile(join(dir, name, "FIXTURE.txt"), "utf8"))?.[1] ?? ""; } catch { expected = ""; }
    out.push({ label, name: name.replace(/\.exam$/, ""), verdict: v.verdict + (v.disagreed ? ` (${v.disagreed})` : ""), expected, score: v.score ? `${v.score.correct}/${v.score.k}` : "-", model: v.model ? v.model.id : "-", paper: v.paper ? `${v.paper.counter}` : "-", pfloor: floor(v.paper?.floor ?? null), answers: v.answers ? `${v.answers.counter}` : "-", afloor: floor(v.answers?.floor ?? null), reason: v.reason ?? "" });
  }
  return out;
}

const all = [...(await rows(DEMO, "demo")), ...(await rows(FIXTURES, "fixture"))];
/* Columns wide enough for the longest name they hold, so a name as long as
 * its column never runs into the next one (gemini-3.1-pro-preview did). */
const W = { name: 22, verdict: 22, score: 6, model: 18, paper: 7, pfloor: 33, answers: 9, afloor: 33 };
W.name = Math.max(W.name, ...all.map((r) => r.name.length + 2));
W.model = Math.max(W.model, ...all.map((r) => r.model.length + 2));
console.log("");
console.log(`  ${pad("folder", W.name)}${pad("verdict", W.verdict)}${pad("score", W.score)}${pad("model", W.model)}${pad("paper", W.paper)}${pad("paper not before block", W.pfloor)}${pad("answers", W.answers)}${pad("answers not before block", W.afloor)}`);
console.log(`  ${"-".repeat(Object.values(W).reduce((a, b) => a + b, 0))}`);
let section = "";
for (const r of all) {
  if (r.label !== section) { section = r.label; console.log(`  ${section === "demo" ? "demo/ (real runs, September 2026)" : "fixtures (from @mikeargento/exam-cli)"}`); }
  console.log(`  ${pad(r.name, W.name)}${pad(r.verdict, W.verdict)}${pad(r.score, W.score)}${pad(r.model, W.model)}${pad(r.paper, W.paper)}${pad(r.pfloor, W.pfloor)}${pad(r.answers, W.answers)}${pad(r.afloor, W.afloor)}`);
  if (r.expected && !r.verdict.startsWith(r.expected.split(" ")[0])) { console.log(`    !! expected ${r.expected}`); process.exitCode = 1; }
  if (r.reason) console.log(`    ${r.reason}`);
}
console.log("");
console.log("  Every value above was recomputed from the files, with fetch and sockets disabled in this process.");
console.log("  Floors are floors: not before block N, whose header time is shown. Nothing here is a ceiling.");
console.log("");

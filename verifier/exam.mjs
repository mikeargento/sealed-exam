#!/usr/bin/env node
/**
 * The exam verifier, with the network nailed shut.
 *
 *   node verifier/exam.mjs verify demo/claude-sonnet-5.exam
 *   node verifier/exam.mjs verify demo/claude-sonnet-5.exam --json
 *
 * This is `exam verify` from the vendored @mikeargento/exam-cli, run in a
 * process where fetch, sockets and HTTP requests all throw. The verifier
 * never asks for them; this wrapper makes that a fact you can see rather
 * than a sentence you have to take. Everything is recomputed from the
 * files in the folder: signatures, the Nitro attestation chain to the AWS
 * root, the floor block's header, the seed, the paper, the grade.
 *
 * Exit codes: 0 ACCEPT, 1 REJECT, 2 NO-EVIDENCE, 3 error.
 */
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const closed = (what) => () => { throw new Error(`the verifier tried to use the network (${what}); this package forbids it`); };
globalThis.fetch = closed("fetch");
net.Socket.prototype.connect = closed("net.connect");
tls.connect = closed("tls.connect");
http.request = closed("http.request");
https.request = closed("https.request");

const args = process.argv.slice(2);
if (args[0] !== "verify" && args[0] !== "selftest") {
  process.stderr.write("usage: node verifier/exam.mjs verify <folder> [--json]\n       node verifier/exam.mjs selftest\n");
  process.exitCode = 64;
} else {
  process.argv = [process.argv[0], "exam", ...args];
  /* The vendored copy in the release zip, or the workspace link in a
     clone. See the note in demo.mjs. */
  const here = fileURLToPath(new URL("./", import.meta.url));
  const vendored = join(here, "node_modules", "@mikeargento", "exam-cli");
  const linked = join(here, "..", "node_modules", "@mikeargento", "exam-cli");
  const cli = existsSync(vendored) ? vendored : linked;
  if (!existsSync(cli)) throw new Error("@mikeargento/exam-cli is not installed; run: npm install && npm run build");
  await import(pathToFileURL(join(cli, "dist", "cli.js")).href);
}

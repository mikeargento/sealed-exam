# Freshness is a claim. This is a check.

Mike Argento, Argento Computing Inc. · bitgraph.ing · github.com/mikeargento/sealed-exam · 14 September 2026

**Proves:** the exact question instances were derived from a commitment that did not exist before
the floor block, so they were not in any training set frozen before that block; the paper's digest
spent that slot; the answer sheet names the paper and sits at a later position on the same chain.

**Does not prove:** that the template families are unfamiliar to the model; that the model worked
alone, without tools, or quickly; when the answers were produced beyond their own floor. The answer
sheet has a floor, not a ceiling.

That paragraph is the whole claim. It is printed by the verifier, it is the last thing on every
report page, and it is what this package asks you to attack. Everything else here is running code
and real evidence: six models from three vendors sat the same kind of paper on 12 and 13 September
2026, each paper derived from a value that came into existence at a signed position on a public
chain, and each sitting is a folder you verify with nothing but Node, offline, in three commands.

The intuition is the newspaper in the photo, turned around. A hash of a question set published
today is a postmark: it proves the set existed no later than now, which is the wrong direction
for contamination. What contamination needs is a floor: proof that the exact questions could not
have existed before some public moment, so no training corpus frozen before it can contain them.
So the questions are made from the newspaper instead of photographed next to it. A slot on the
BitGraph chain is allocated; the enclave signs into it the latest Ethereum block it has
authenticated; a commitment is derived from that signed slot record; the twenty questions are
derived, deterministically, from that commitment and a public bank; the paper is committed under
the same slot. The paper cannot predate the block, because it is a function of a value that did
not exist before the slot did. The answer sheet is then recorded at a later position, which is
the postmark half, with its own floor. "Fresh" stops being a promise about a process and becomes
a check a stranger runs.

---

## The result

`node verifier/demo.mjs` prints this. Every value was recomputed by that program from the files
in this package, in a process where `fetch` and sockets throw.

```
  folder                  verdict               score model                   paper  paper not before block           answers  answers not before block
  demo/ (real runs, September 2026)
  claude-haiku-4-5        ACCEPT                17/20 claude-haiku-4-5        8604   25962581 12 Sep 2026 16:38:35Z   8607     25962581 12 Sep 2026 16:38:35Z
  claude-opus-4-8         ACCEPT                20/20 claude-opus-4-8         8610   25962581 12 Sep 2026 16:38:35Z   8616     25962584 12 Sep 2026 16:39:11Z
  claude-opus-5           ACCEPT                16/20 claude-opus-5           8590   25962577 12 Sep 2026 16:37:47Z   8598     25962579 12 Sep 2026 16:38:11Z
  claude-sonnet-5         ACCEPT                20/20 claude-sonnet-5         8596   25962579 12 Sep 2026 16:38:11Z   8614     25962584 12 Sep 2026 16:39:11Z
  gemini-3.1-pro-preview  ACCEPT                20/20 gemini-3.1-pro-preview  9790   25970424 13 Sep 2026 18:51:23Z   9822     25970442 13 Sep 2026 18:54:59Z
  gpt-6-astra             ACCEPT                20/20 gpt-6-astra             9750   25970404 13 Sep 2026 18:47:23Z   9756     25970407 13 Sep 2026 18:47:59Z
  fixtures (from @mikeargento/exam-cli)
  answers-before-paper    REJECT (order)        14/20 claude-haiku-4-5        8552   25962561 12 Sep 2026 16:34:35Z   8551     25962566 12 Sep 2026 16:35:35Z
  copied-answers          REJECT (answers)      0/20  claude-haiku-4-5        8604   25962581 12 Sep 2026 16:38:35Z   8562     25962566 12 Sep 2026 16:35:35Z
  edited-paper            REJECT (paper)        15/20 claude-haiku-4-5        8584   25962576 12 Sep 2026 16:37:35Z   8594     25962579 12 Sep 2026 16:38:11Z
  graded-file-lies        ACCEPT                14/20 claude-haiku-4-5        8552   25962561 12 Sep 2026 16:34:35Z   8562     25962566 12 Sep 2026 16:35:35Z
  honest                  ACCEPT                14/20 claude-haiku-4-5        8552   25962561 12 Sep 2026 16:34:35Z   8562     25962566 12 Sep 2026 16:35:35Z
  no-bank                 NO-EVIDENCE           -     -                       -      -                                -        -
  swapped-commitment      REJECT (commitment)   0/20  claude-haiku-4-5        8604   25962581 12 Sep 2026 16:38:35Z   8562     25962566 12 Sep 2026 16:35:35Z
```

Three words, kept apart the way the Player's `check` keeps its three values apart. **ACCEPT**:
everything recomputes and agrees, and the score is what re-running the checkers says.
**REJECT**: something in the folder recomputes and disagrees, and the verifier says which of four
things: the paper, the commitment, the answers, or the order. **NO-EVIDENCE**: something the
claim needs is not in hand. Absence is never a verdict against the run.

All six sittings are one chain, `bitgraph:main`, one enclave. The four Anthropic sittings are one
epoch, within two minutes of each other on 12 September; the GPT-6 and Gemini sittings are the
next day's epoch, since the enclave starts a fresh epoch each UTC day. Positions are counters on that chain;
a paper's position is the commit that spent its slot. The block numbers are Ethereum mainnet. Block 25962579, the floor of the Sonnet 5 paper,
is at https://etherscan.io/block/25962579 and shows `Sep-12-2026 04:38:11 PM +UTC`, the same second
the witness header in `demo/claude-sonnet-5.exam/paper/ethereum-anchors/` decodes to.

Four of the six scored 20/20. The bank is small and the families are easy for a frontier model
on purpose: this demonstration is about freshness, not difficulty. Haiku 4.5 missed three
nine-digit multiplications. GPT-6 Astra and Gemini 3.1 Pro, asked with an OpenAI key and a Google key
through the same one-request-per-question path, each answered all twenty; their raw replies are in
their `raw/`, like the others'. Opus 5 answered 16 correctly and **refused four questions outright**
(`stop_reason: refusal`, category `cyber`, zero output tokens): three string-transformation
puzzles, whose letter-shifting step its classifier reads as a cipher, and one function
specification. The refusals are in `raw/` exactly as the API returned them, count as wrong, and the
verdict carries a note. No fallback model is configured, on purpose: an answer from a different
model attributed to the one asked would be the wrong record.

The seven fixtures are what the verifier is for. Each was made from real positions, not by
editing signatures into shape:

- **honest**: an untouched sitting (Haiku 4.5, 14/20).
- **edited-paper**: a slot was opened, the paper derived, one prompt altered, and the altered paper
  fused and committed under that same slot, for real. Its proof is valid and its bytes match the
  proof. It fails at step 2: re-deriving the paper from the commitment gives a different question 7.
  This is the only way an edit can land at step 2; a paper edited after commit stops matching its
  proof and fails at step 1 instead.
- **swapped-commitment**: one sitting's paper presented with another sitting's proof. The trailer
  carries the wrong slot's commitment.
- **answers-before-paper**: the answer sheet's proof with its counter moved below the paper's.
  A real enclave cannot sign this (the paper's digest does not exist before its slot), so the move
  also breaks the signature; the verifier checks the order first and names it.
- **copied-answers**: run A's answer sheet presented with run B's paper. The sheet names a different
  paper by digest.
- **no-bank**: the folder without `bank/`. Nothing can be re-derived, and nothing is held against
  the run.
- **graded-file-lies**: an honest folder with a `grade.json` claiming 20/20. The verifier never
  reads it, prints 14/20, and says so.

---

## How a sitting is made

The Sonnet 5 folder, `demo/claude-sonnet-5.exam/`, step by step, with its own numbers. All of them
are in the files and are recomputed by the verifier.

1. **Open.** `POST /api/fuse/allocate` on bitgraph.ing returns a signed slot record: slot 8595 on
   `bitgraph:main`, epoch `C+9anWqI…`, a 32-byte nonce from the enclave's hardware entropy, the
   enclave's signature. When it allocated that slot the enclave copied into it the latest Ethereum
   anchor it had itself authenticated: the anchor at position 8592, block 25962579. That copy is
   what the proof later carries, signed, as `commit.slotAnchor`. The floor is fixed here, before
   any question exists.
2. **Commitment.** `SHA-256("bitgraph-fuse/1" || 0x00 || SHA-256(canonical slot body) || nonce)`
   = `G0uWzf/5A2CxGsFh5bWULqkbbeoP4ntvopij4f0dl/U=`. Recomputable by anyone from the slot record
   inside the proof; the nonce is public once the proof is.
3. **Seed.** `SHA-256("exam/1" || 0x00 || commitment || 0x00 || bankDigest)`, where the bank
   digest is `/VEJoBwdHB4yZlPWNOg1IPVAMJiTAO8l7qoUmGIdBpg=`, SHA-256 of the canonical bank
   document, which itself carries the SHA-256 of a deterministic archive of the generator source.
   The bank was recorded once, as an ordinary BitGraph at position 8546 (floor block 25962560),
   before any of these papers; its proof ships in `bank/`.
4. **Draw.** An HMAC-DRBG (SHA-256, SP 800-90A, vendored, vectors in SPEC.md) seeded with the seed
   draws twenty questions, four from each of five families, in a documented order: multi-step
   arithmetic with six-to-nine-digit operands, a seating puzzle with a solver-enforced unique
   answer, a string-transformation pipeline, a small specification to be turned into a JavaScript
   function (checked by running it on five hidden inputs in a permission-restricted child process),
   and an ordering task over generated facts. The canonical answers come out of the same draw and
   are never written down: grading re-runs the draw.
5. **Paper.** The canonical JSON of `{version, bankDigestB64, commitmentB64, k, questions}`, SHA-256
   `ghhoPeG10C4tSzrqbq0PL+++xaqEuUJCXGyHbq+crjA=`. Fused under placement `trailer/1`: the paper
   bytes plus a 48-byte trailer (`BGFUSE01`, eight zero bytes, the commitment). The fused bytes,
   SHA-256 `CE2uUspIiXQmqmxlXS+TQhjLXZTPemZoKWNQz5hO4NI=`, are committed under slot 8595 and land at
   position 8596. The proof's signed attribution names the placement and the origin digest, so a
   holder of `paper.json` alone can rebuild the committed bytes exactly.
6. **Ask.** One request per question to the model's own API, with the caller's own key; the
   request body and the response body are written verbatim to `raw/q01.json` … `raw/q20.json`.
   The answer sheet lists, per question, the extracted answer and the SHA-256 of that raw file.
7. **Answers.** The sheet, canonical JSON with `paperDigestB64 = CE2u…` (the fused paper's digest),
   is recorded as an ordinary BitGraph: position 8614, its own signed floor block 25962584. The
   binding to the paper is the digest inside the committed sheet; the order is the chain's.
8. **Export, verify, report.** The folder is written in the shape the bitgraph.ing drop zone
   reads (drop it there and both positions show), then verified offline, and `report.html` is
   written beside the files.

One of the twenty, question 1 of that paper, as the model saw it, and what came back:

```
4 people (Dev, Cleo, Ada, Esme) sit in a row of 4 seats numbered 1 to 4 from left to right. All of the following are true:

1. Dev and Cleo do not sit next to each other.
2. Dev sits at one end of the row.
3. Cleo sits in seat 3.
4. Ada sits somewhere to the left of Cleo.
5. Esme does not sit in seat 3.
6. There are exactly 2 seats between Dev and Esme.
7. Ada and Dev sit next to each other.

Who sits where?
```

Model: `Dev, Ada, Cleo, Esme`. Canonical, re-derived at grading: `Dev, Ada, Cleo, Esme`. The names,
the constraints and the arrangement were all drawn from the seed; nobody wrote this puzzle, and it
did not exist before block 25962579.

---

## What the verifier checks

`exam verify <folder>`, from the files only. The four steps of the design, in order.

1. **The paper's BitGraph, as any fused file's is checked today.** The enclave's Ed25519
   signature over the signed body; the slot record's own signature and its binding into the commit
   (`slotHashB64`, nonce, slot counter below commit counter); the fused bytes hash to the committed
   digest and carry the slot's commitment in the trailer (`verifyFuse` from
   `@mikeargento/bitgraph-verify`, category `FUSED_DIRECT`); the origin recovered by stripping the
   trailer is the one the signed attribution names; the AWS Nitro attestation document inside the
   proof validates to the AWS root, its PCR0 equals the proof's measurement, its `user_data` equals
   SHA-256 of the signed body (`validateNitroAttestationDocument` from `@mikeargento/bitgraph-audit`);
   the PCR0 is a published BitGraph measurement; the witness block header keccak-hashes to the
   signed floor's block hash, and its timestamp is the floor.
2. **The paper re-derived.** The commitment recomputed from the slot record; the bank digest
   recomputed from `bank/bank.json` and `bank/generator.tar` and checked against what the paper
   names; the verifier's own generator source checked against the shipped archive, byte for byte;
   the seed; all twenty questions re-instantiated and compared to the committed paper byte for
   byte. Any difference: REJECT, the paper is not what this slot produces.
3. **The answer sheet.** `answers.json` hashes to its proof's digest; `paperDigestB64` equals the
   fused paper's digest; same epoch, same chain, counter greater than the paper's (a different
   epoch is NO-EVIDENCE with the reason, not a failure); the sheet's proof verifies as in step 1,
   attestation included; each raw reply present hashes to the digest the sheet names.
4. **The grade.** Canonical answers re-derived from the seed; each family's checker run; the score
   printed. Never read from a file.

Exit codes follow the Player: 0 ACCEPT, 1 REJECT, 2 NO-EVIDENCE, 3 error.

---

## Where the floor comes from

The enclave is an AWS Nitro image whose measurement, `eccfc1c78006f4b7…`, is reproducible from
tag `enclave-v8` of https://github.com/mikeargento/bitgraph with
`server/commit-service/reproducible-build/verify-pcr0.sh`. Three things it does are what this
package rests on.

It authenticates anchors. The anchor service signs each claim (epoch, chain, block number, block
hash) with a key whose public half is a constant of the enclave image; the enclave verifies the
signature, requires block numbers to climb within the epoch, and only then signs `commit.anchor`
into an anchor proof. It fixes the floor at allocation: every slot gets a copy of the chain's
latest authenticated anchor, and the proof that fills the slot carries that copy, signed, as
`commit.slotAnchor`. The issuer did not choose it, the packager cannot change it without breaking
the signature, and the verifier does not choose it either; it reads the block hash from the proof
and checks one header. And it refuses to sign a floorless proof: a slot allocated before an
epoch's first anchor has no floor, so the boundary declines it.

Nothing was added to the enclave for this demonstration. The paper is fused under `trailer/1`
exactly as a photograph is on bitgraph.ing; the answer sheet is recorded exactly as any file is.
What is new is only what the bytes are: a paper that is a function of the commitment.

---

## What is trusted

- **The AWS Nitro Enclaves root CA**, bundled in the vendored auditor, the same PEM Amazon
  publishes. A document that validates and binds is Amazon's hardware saying: this measurement
  produced this signed body under this key.
- **The published measurement**, `eccfc1c78006f4b7…`, reproducible from the tag above on any
  linux/amd64 host. That is what makes the enclave's rules yours to read: the floor copied at
  allocation, the refusal to sign without one, the 120-second slot lifetime, one filling per slot.
- **Ethereum**, for the floor's block header and its timestamp. The verifier checks the header
  hashes to the enclave-signed block hash; that the block is canonical is Ethereum's claim.
- **The vendored verification code**, all MIT, all readable: `@mikeargento/bitgraph-verify`,
  `@mikeargento/bitgraph-audit`, `@mikeargento/bitgraph-player` (for the list of published
  measurements), `@mikeargento/exam-verify`, and the noble cryptography underneath.

Not trusted: bitgraph.ing, its ledger, the packager, the model provider, and me. The verifier asks
none of them anything; `verifier/exam.mjs` replaces `fetch` and every socket constructor with a
throw before it loads, so a verifier that tried would fail loudly rather than quietly.

---

## Does not prove

- The families (seating, big arithmetic, string pipelines, JS specs, date order) are unfamiliar.
- The model had no tools, no help, or a time bound.
- When the answers were produced, other than "not before the answer sheet's own floor." No ceiling.
- General capability. The bank is easy on purpose.

---

## Before you run it

You are being asked to run a stranger's code. Here is what it does, and how to check that rather than take it.

**It reaches nothing.** Both entry points open the same way: `verifier/exam.mjs` lines 25 to 30 and `verifier/demo.mjs`
lines 18 to 23 replace `fetch`, `net.Socket.prototype.connect`, `tls.connect`, `http.request` and `https.request` with
functions that throw, so a verifier that reached for the network would fail loudly rather than quietly. The shortest
test is to turn your network off and then run the commands below: every number still prints, because none of it was
ever coming from anywhere but the files in this folder.

**It executes exactly one thing, and that thing is not ours.** One of the five question families asks the model to
write a JavaScript function, and grading it means running it. That happens in a child process launched as
`node --permission --allow-fs-read=<the one file> --max-old-space-size=64`, with an empty environment and a timeout.
What will run is sitting in `raw/` and you can read it first. The limit is stated in the source as well as here:
`--permission` constrains the filesystem, not sockets, which is why the grader is also the only part of this package
that runs anything at all.

**You do not have to run any of it.** The table above is the output. Every folder is JSON that opens in a text editor.
`SPEC.md` is the entire derivation, and the section after this one says how to redo the check in another language.

## Run it

Node 20 or later, and then the same three commands whichever way you got this.

**From a clone**, one install, which is the only moment anything touches the network. The five exam
packages are the workspaces in `packages/`; `npm install` fetches the published BitGraph verifier,
auditor and player they build on, and `npm run build` compiles the five with `tsc`.

```bash
git clone https://github.com/mikeargento/sealed-exam
cd sealed-exam
npm install
npm run build
```

**From `BitGraph-Sealed-Exam-Demo.zip`** on the Releases page, nothing at all: the five packages
and their dependencies are vendored under `verifier/node_modules/`, so there is no install step
and no network at any point. Take this one if you would rather run than read, or if you want to
watch it work with the wifi off.

```bash
node verifier/demo.mjs                                   # the table above, every value recomputed
node verifier/exam.mjs verify demo/claude-sonnet-5.exam  # one folder, every check listed; writes report.html and verdict.json beside it
node verifier/exam.mjs selftest                          # DRBG vectors, determinism, checkers, the sandbox fences, the seven fixtures: 11 self-tests
```

Open `demo/claude-sonnet-5.exam/report.html` after the second command: one page, no scripts, the
verdict word, the score, the sentence with the block number linked to a public explorer, the two
floors, the model, the families, one question opened up, and the claim boundary. It reads with CSS
off. Or drop any `demo/*.exam` folder on https://bitgraph.ing (that one needs the network): the site
reads the paper and the answers as two positions with no changes made for this demonstration.

To re-derive a paper without any of this code, `SPEC.md` is the whole derivation: the seed, the
DRBG with vectors, the draw order, the archive format, the two positions. An afternoon in Python.

## Making a sitting of your own

The tools are in `packages/` as tarballs for anyone who wants to run a sitting rather than check
one: `npm install ./packages/*.tgz`, then `npx exam run` with your own API key. It is not required
for anything above.

---

## What is in here

```
demo/<model>.exam/                the six sittings; each holds:
  paper/                            paper.json (the twenty questions), new-file/paper.fused.json (the committed bytes), proof.json, ethereum-anchors/
  answers/                          answers.json, proof.json, ethereum-anchors/
  bank/                             bank.json, generator.tar, proof.json (the bank's own recording, position 8546), ethereum-anchors/
  raw/q01.json … q20.json           every request and reply, verbatim
  README.txt, report.html, verdict.json
demo/<model>.console.txt          what `exam run` printed
demo/<model>.console.txt          what `exam run` printed
packages/exam-bank/               the five packages, in source:
packages/exam-core/                 bank and generators; seed, DRBG, derivation, the two positions;
packages/exam-ask/                  asking a model; offline verification and grading; the CLI.
packages/exam-verify/               exam-cli/fixtures/ holds the seven fixtures.
packages/exam-cli/
verifier/exam.mjs                 `exam verify` and `exam selftest` with the network nailed shut
verifier/demo.mjs                 the table
SPEC.md                           the derivation, with vectors
LICENSE.txt, THIRD-PARTY-NOTICES.txt
```

The release zip is this tree with `packages/` packed to tarballs and the verification path
vendored under `verifier/node_modules/`, so that it runs with nothing installed. Everything you
can read here is what is in there.

## License

The verification path is MIT: `verifier/`, `@mikeargento/exam-verify`, and the BitGraph verifier,
auditor and player it builds on. Verification of BitGraph proofs is and remains permissionless.
The packages that make positions and papers are under the BitGraph license in `LICENSE.txt`, with
an evaluation grant written in so that you can run `exam run` against bitgraph.ing and check the
result yourself. The mechanism, a position allocated before the bytes exist, is patent pending.

Mike Argento · mike@bitgraph.ing

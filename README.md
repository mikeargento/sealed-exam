# Freshness is a claim. This is a check.

Mike Argento, Argento Computing Inc. · bitgraph.ing · github.com/mikeargento/sealed-exam · 7 October 2026

**These exact questions could not have existed before BitGraph #97 began.** That is the
sentence each sitting's report leads with, here for the Sonnet 5.5 paper. Its BitGraph began after
Base block 52275983.

**Proves:** the exact question instances were derived from the position commitment, a value that
did not exist until the enclave opened the paper's position, so the questions did not exist before
that position; the position opened after its floor block, so they were not in any training set
frozen before that block; the paper's digest spent that position; the answer sheet names the paper
and sits at a later position on the same chain; where a unit's `base-ceiling/` is in the folder, it
existed by that Base block.

**Does not prove:** that the template families are unfamiliar to the model; that the model worked
alone, without tools, or quickly.

That paragraph is the whole claim. It is printed by the verifier, it is the last thing on every
report page, and it is what this package asks you to attack. Everything else here is running code
and real evidence: six models from two vendors sat the same kind of paper on 7 October 2026,
within about two minutes of each other, each paper derived from a value that came into existence
when its BitGraph began, and each sitting is a folder you verify with nothing but Node, offline, in
three commands.

The intuition is the newspaper in the photo, turned around. A hash of a question set published
today is a postmark: it proves the set existed no later than now, which is the wrong direction
for contamination. What contamination needs is a floor: proof that the exact questions could not
have existed before some public moment, so no training corpus frozen before it can contain them.
So the questions are made from the newspaper instead of photographed next to it, and the newspaper
is the position itself. The enclave opens a position on the BitGraph chain: it draws a nonce from
its hardware random generator, signs a position record, and fixes to that position the newest Base
block it has been given, which the proof that fills the position carries signed. The position
commitment is derived from the signed record. The twenty questions
are derived, deterministically, from the commitment and a public bank, and the paper is committed
under the same position. The commitment did not exist before the position opened, so neither did
the paper: that is the floor that matters. The Base block is what lets anyone date that moment
publicly, since the position opened after it. The answer sheet is then recorded at a later
position, which is the postmark half, with its own floor. Seconds after each BitGraph is made, a
Base transaction carries it, and the block that includes it is its ceiling; the folder holds both
ends of each, so the whole of every BitGraph checks from the files. "Fresh" stops being a promise
about a process and becomes a check a stranger runs.

---

## The result

`node verifier/demo.mjs` prints this. Every value was recomputed by that program from the files
in this package, in a process where `fetch` and sockets throw.

```
  folder                verdict              score  paper  floor               ceiling             answers  floor               ceiling
  --------------------------------------------------------------------------------------------------------------------------------------------------
  demo/ (real runs, 7 October 2026)
  claude-fable-5-1      ACCEPT               8/20   #101   52275995 02:48:57Z  52275998 02:49:03Z  #103     52276001 02:49:09Z  52276004 02:49:15Z
  claude-haiku-4-5      ACCEPT               14/20  #89    52275957 02:47:41Z  52275960 02:47:47Z  #91      52275967 02:48:01Z  52275969 02:48:05Z
  claude-opus-5-5       ACCEPT               17/20  #93    52275971 02:48:09Z  52275973 02:48:13Z  #95      52275983 02:48:33Z  52275985 02:48:37Z
  claude-sonnet-5-5     ACCEPT               19/20  #97    52275983 02:48:33Z  52275987 02:48:41Z  #99      52275994 02:48:55Z  52275996 02:48:59Z
  gpt-6-astra           ACCEPT               20/20  #105   52276003 02:49:13Z  52276007 02:49:21Z  #107     52276016 02:49:39Z  52276018 02:49:43Z
  gpt-6-luna            ACCEPT               20/20  #109   52276017 02:49:41Z  52276020 02:49:47Z  #111     52276024 02:49:55Z  52276025 02:49:57Z
  fixtures (from @mikeargento/exam-cli)
  answers-before-paper  REJECT (order)       14/20  #89    52275957 02:47:41Z  52275960 02:47:47Z  #88      52275967 02:48:01Z  -
    The answer sheet sits at position 88, which is not after the paper at position 89.
  copied-answers        REJECT (answers)     0/20   #93    52275971 02:48:09Z  52275973 02:48:13Z  #91      52275967 02:48:01Z  52275969 02:48:05Z
    The answer sheet names a different paper than the one in this folder.
  edited-paper          REJECT (paper)       13/20  #117   52276410 03:02:47Z  52276413 03:02:53Z  #119     52276421 03:03:09Z  52276423 03:03:13Z
    The committed paper is not the paper this slot produces: question 1 differs.
  graded-file-lies      ACCEPT               14/20  #89    52275957 02:47:41Z  52275960 02:47:47Z  #91      52275967 02:48:01Z  52275969 02:48:05Z
  honest                ACCEPT               14/20  #89    52275957 02:47:41Z  52275960 02:47:47Z  #91      52275967 02:48:01Z  52275969 02:48:05Z
  no-bank               NO-EVIDENCE          -      -      -                   -                   -        -                   -
    Missing from the folder: bank/bank.json, bank/generator.tar. Nothing here is a finding against the run; the files are simply not in hand.
  swapped-commitment    REJECT (commitment)  0/20   #97    52275983 02:48:33Z  52275987 02:48:41Z  #91      52275967 02:48:01Z  52275969 02:48:05Z
    The commitment in the paper's trailer is not the commitment of the slot this proof was signed under; the paper was fused for a different position.

  Every value above was recomputed from the files, with fetch and sockets disabled in this process.
  paper and answers: each BitGraph, by number. floor: not before this Base block (the time in its header).
  ceiling: existed by this Base block (the time in its header). All times UTC.
```

Three words, kept apart the way the Player's `check` keeps its three values apart. **ACCEPT**:
everything recomputes and agrees, and the score is what re-running the checkers says.
**REJECT**: something in the folder recomputes and disagrees, and the verifier says which of four
things: the paper, the commitment, the answers, or the order. **NO-EVIDENCE**: something the
claim needs is not in hand. Absence is never a verdict against the run.

All six sittings are one chain, `bitgraph:main`, one enclave (v10), one epoch: the papers were
sealed between 02:47:43 and 02:49:43 UTC on 7 October 2026. Each BitGraph is named by its position
on that chain, as its proof page names it, and the paper's BitGraph spent the position opened just
before it. The block numbers are Base mainnet, which stamps block N at `1686789347 + 2 × N` seconds:
block 52275983, the floor of the Sonnet 5.5 paper, is 7 October 2026 02:48:33 UTC
(https://basescan.org/block/52275983), the second the header in
`demo/claude-sonnet-5-5.exam/paper/base-floor/floor-header.json` decodes to. The September
sittings, on an Ethereum floor, are in `archive/2026-09-sittings/` and verify as they always did.

GPT-6 Astra and GPT-6 Luna scored 20/20, Sonnet 5.5 19, Opus 5.5 17, Haiku 4.5 14, Fable 5.1 8.
The bank is small and the families are easy for a frontier model on purpose: this demonstration
is about freshness, not difficulty. Haiku 4.5 is the only model that answered anything wrong: all
four nine-digit multiplications, one string pipeline and one function specification. Every other
point lost was a refusal. Opus 5.5, Sonnet 5.5 and Fable 5.1 got right every question they
answered and **refused the rest outright** (`stop_reason: refusal`, category `cyber`, zero output
tokens): Sonnet one function specification; Opus three string-transformation puzzles; Fable twelve,
every string puzzle, every function specification and every multiplication. The refusals are in
`raw/` exactly as the API returned them, count as wrong, and the verdict carries a note. No fallback
model is configured, on purpose: an answer from a different model attributed to the one asked would
be the wrong record.

The seven fixtures are what the verifier is for. Each was made from real positions, not by
editing signatures into shape:

- **honest**: an untouched sitting (Haiku 4.5, 14/20).
- **edited-paper**: a slot was opened, the paper derived, one prompt altered, and the altered paper
  fused and committed under that same slot, for real. Its proof is valid and its bytes match the
  proof. It fails at step 2: re-deriving the paper from the commitment gives a different question 1.
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

The Sonnet 5.5 folder, `demo/claude-sonnet-5-5.exam/`, step by step, with its own numbers. All of
them are in the files and are recomputed by the verifier.

1. **Open.** `POST /api/fuse/allocate` on bitgraph.ing returns a signed position record: position
   96 on `bitgraph:main`, epoch `8To+KaIm…`, a 32-byte nonce from the enclave's hardware entropy,
   the enclave's signature, and the Base block the enclave fixed for that position as it opened
   it: block 52275983. The proof that fills the position signs that block as `commit.slotFloor`.
   The floor is fixed here, before any question exists.
2. **Commitment.** `SHA-256("bitgraph-fuse/1" || 0x00 || SHA-256(canonical position record) || nonce)`
   = `PoL3tDFjUYVyNdJcYJnc6Irazg1MLSQIK1dNiDjAjyQ=`. Recomputable by anyone from the position record
   inside the proof; the nonce is public once the proof is.
3. **Seed.** `SHA-256("exam/1" || 0x00 || commitment || 0x00 || bankDigest)`, where the bank
   digest is `/VEJoBwdHB4yZlPWNOg1IPVAMJiTAO8l7qoUmGIdBpg=`, SHA-256 of the canonical bank
   document, which itself carries the SHA-256 of a deterministic archive of the generator source.
   The bank was recorded once, as an ordinary BitGraph at position 8546 on 12 September 2026
   (Ethereum floor block 25962560), before any of these papers; its proof ships in `bank/`.
4. **Draw.** An HMAC-DRBG (SHA-256, SP 800-90A, vendored, vectors in SPEC.md) seeded with the seed
   draws twenty questions, four from each of five families, in a documented order: multi-step
   arithmetic with six-to-nine-digit operands, a seating puzzle with a solver-enforced unique
   answer, a string-transformation pipeline, a small specification to be turned into a JavaScript
   function (checked by running it on five hidden inputs in a permission-restricted child process),
   and an ordering task over generated facts. The canonical answers come out of the same draw and
   are never written down: grading re-runs the draw.
5. **Paper.** The canonical JSON of `{version, bankDigestB64, commitmentB64, k, questions}`, SHA-256
   `yRzQ7AAKXPoFWb8fcYTI5sGasU809pNbt90LE36Hfyk=`. Fused under placement `trailer/1`: the paper
   bytes plus a 48-byte trailer (`BGFUSE01`, eight zero bytes, the commitment). The fused bytes,
   SHA-256 `ITjVZgVqhLIDZv6LYD7aXVV4Df22rdFNhH2p/z2VMp4=`, are committed under position 96 and land
   at position 97: BitGraph #97, recorded at 02:48:36 UTC by its attestation, and carried by a Base
   transaction included in block 52275987 (02:48:41 UTC), its ceiling. The proof's signed
   attribution names the placement and the origin digest, so a holder of `paper.json` alone can
   rebuild the committed bytes exactly.
6. **Ask.** One request per question to the model's own API, with the caller's own key; the
   request body and the response body are written verbatim to `raw/q01.json` … `raw/q20.json`.
   The answer sheet lists, per question, the extracted answer and the SHA-256 of that raw file.
7. **Answers.** The sheet, canonical JSON with `paperDigestB64 = ITjV…` (the fused paper's digest),
   is recorded as an ordinary BitGraph: BitGraph #99, floor Base block 52275994 (02:48:55 UTC),
   recorded at 02:48:57, ceiling Base block 52275996 (02:48:59 UTC). The binding to the paper is the
   digest inside the committed sheet; the order is the chain's.
8. **Export, verify, report.** The folder is written in the shape the bitgraph.ing drop zone
   reads (drop it there and both BitGraphs show). Each BitGraph's Base ceiling is fetched into
   `base-ceiling/ceiling.json` and kept only if it checks against the proof. Then the folder is
   verified offline, and `report.html` is written beside the files.

One of the twenty, question 1 of that paper, as the model saw it, and what came back:

```
Start with the string (between the brackets, without them): [lpgavokSCisDKFXjm9G]

Apply these steps in order:

1. Replace every occurrence of the character X with v (case-sensitive).
2. Swap the case of every letter (lowercase becomes uppercase and uppercase becomes lowercase); leave digits unchanged.
3. Reverse the string.
4. Keep only the characters at odd positions (the 1st, 3rd, 5th, …, counting from 1).

What is the resulting string?
```

Model: `gMVkScKVGL`. Canonical, re-derived at grading: `gMVkScKVGL`. The string and the steps were
drawn from the seed; nobody wrote this puzzle, and it did not exist before BitGraph #97 began.

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
   the PCR0 is a published BitGraph measurement; the floor block's header checks against the floor
   the proof signs. For a Base floor (`commit.slotFloor`) that header is
   `base-floor/floor-header.json`: it keccak-hashes to the signed block hash, carries the signed
   number and the signed time, and that time is Base mainnet's schedule for the block; the time is
   the floor unless it is later than the attestation document, in which case it is withheld and
   said so. For an Ethereum floor (`commit.slotAnchor`, papers made before 7 October 2026) the
   witness header in `ethereum-anchors/` keccak-hashes to the signed block hash, and its timestamp
   is the floor. Where `base-ceiling/ceiling.json` is in the folder, the Base ceiling: a
   transaction from BitGraph's published writer, included in a Base block by the inclusion proof
   and header the file carries, whose Merkle root covers this proof's hash (`verifyCeiling` from
   `@mikeargento/bitgraph-verify`). A ceiling file that does not check is a contradiction; one that
   is absent is said so and not held against the run.
2. **The paper re-derived.** The commitment recomputed from the slot record; the bank digest
   recomputed from `bank/bank.json` and `bank/generator.tar` and checked against what the paper
   names; the verifier's own generator source checked against the shipped archive, byte for byte;
   the seed; all twenty questions re-instantiated and compared to the committed paper byte for
   byte. Any difference: REJECT, the paper is not what this slot produces.
3. **The answer sheet.** `answers.json` hashes to its proof's digest; `paperDigestB64` equals the
   fused paper's digest; same epoch, same chain, counter greater than the paper's (a different
   epoch is NO-EVIDENCE with the reason, not a failure); the sheet's proof verifies as in step 1,
   attestation, floor and ceiling included; each raw reply present hashes to the digest the sheet names.
4. **The grade.** Canonical answers re-derived from the seed; each family's checker run; the score
   printed. Never read from a file.

Exit codes follow the Player: 0 ACCEPT, 1 REJECT, 2 NO-EVIDENCE, 3 error.

---

## Where the floor comes from

The enclave is an AWS Nitro image whose measurement,
`5a947cc66095adcceefa9e5ece5d1416dfe08c3470df1bcaa5b2bc5267b0480e6cdc172fe077cd06b0afb07614307973`,
is reproducible from tag `enclave-v10` of https://github.com/mikeargento/bitgraph with
`server/commit-service/reproducible-build/verify-pcr0.sh`. Three things it does are what this
package rests on.

It opens the position before anything exists to put in it. The nonce comes from the enclave's
hardware random generator, the position record is signed inside the enclave, and the position
commitment is derived from that signed record, so no one outside could have computed it earlier.
It fixes the floor at that same moment: the newest Base block it has been given, checked inside the
enclave against the header it hashed itself, is kept with the position and signed into the proof
that fills it as `commit.slotFloor` (chain, number, hash, time). The issuer did not choose it, the
packager cannot change it without breaking the signature, and the verifier does not choose it
either; it reads the block from the proof and checks one header: keccak-256 to the signed hash,
the signed number, the signed time, and Base mainnet's schedule, which stamps block N at
`1686789347 + 2 × N`. And it refuses a position with no floor: without a Base header the
boundary declines to open one.

Papers made before 7 October 2026 (enclave v7 to v9) have an Ethereum floor instead: every slot got
a copy of the chain's latest authenticated Ethereum anchor, carried signed as `commit.slotAnchor`,
with the anchor proofs and their header witnesses in `ethereum-anchors/`. Those folders verify as
they always have. New positions have no Ethereum anchors at all, and no anchor after them: order
after the paper is the chain of proof hashes.

The ceiling comes after, from outside the enclave. Seconds after a BitGraph is made, BitGraph's
ceiling writer (`0xf3972408D853c975F86351C311f4310220bbF2a3` on Base) posts a Merkle root over the
newest proofs' hashes in a transaction, and the block that includes it is the ceiling: the BitGraph
existed by then. The file in `base-ceiling/` carries the transaction, its proof of inclusion
against the block's transactions root, and the block's header, so it checks offline.

Nothing was added to the enclave for this demonstration. The paper is fused under `trailer/1`
exactly as a photograph is on bitgraph.ing, under the bare position commitment (`bitgraph-fuse/1`);
the answer sheet is recorded exactly as any file is. What is new is only what the bytes are: a
paper that is a function of the commitment.

---

## What is trusted

- **The AWS Nitro Enclaves root CA**, bundled in the vendored auditor, the same PEM Amazon
  publishes. A document that validates and binds is Amazon's hardware saying: this measurement
  produced this signed body under this key.
- **The published measurement**, `5a947cc66095adcc…`, reproducible from the tag above on any
  linux/amd64 host. That is what makes the enclave's rules yours to read: the floor fixed at
  allocation, the refusal to open a position without one, the 120-second slot lifetime, one
  filling per slot. Earlier papers name earlier measurements, each published with its tag.
- **Base**, for the floor block and the ceiling block: their headers and times. The enclave checks
  the floor header it was given before it signs the block; the verifier checks the header beside
  the proof hashes to the signed block hash and keeps Base mainnet's schedule, and that the ceiling
  transaction is included in the block whose header the ceiling file carries. That those blocks are
  canonical is Base's claim, resting on its sequencer until its batch data is on Ethereum.
- **Ethereum**, only for papers made before 7 October 2026, whose floors are Ethereum anchors: the
  verifier checks the witness header hashes to the enclave-signed block hash; that the block is
  canonical is Ethereum's claim.
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

**From `BitGraph-Sealed-Exam.zip`** on the Releases page, nothing at all: the five packages
and their dependencies are vendored under `verifier/node_modules/`, so there is no install step
and no network at any point. Take this one if you would rather run than read, or if you want to
watch it work with the wifi off.

```bash
node verifier/demo.mjs                                   # the table above, every value recomputed
node verifier/exam.mjs verify demo/claude-sonnet-5-5.exam  # one folder, every check listed; writes report.html and verdict.json beside it
node verifier/exam.mjs selftest                          # DRBG vectors, determinism, checkers, the sandbox fences, the seven fixtures: 11 self-tests
```

Open `demo/claude-sonnet-5-5.exam/report.html` after the second command: one page, no scripts, the
verdict word, the score, the sentence with the paper's BitGraph linked to its proof page, the two
BitGraphs each with its floor, recorded time and ceiling (blocks linked to a public explorer), the
model, the families, one question opened up, and the claim boundary. It reads with CSS
off. Or drop any `demo/*.exam` folder on https://bitgraph.ing (that one needs the network): the site
reads the paper and the answers as two BitGraphs with no changes made for this demonstration.

To re-derive a paper without any of this code, `SPEC.md` is the whole derivation: the seed, the
DRBG with vectors, the draw order, the archive format, the two positions. An afternoon in Python.

## Making a sitting of your own

Checking the folders above needs none of this. Running a sitting does, and it needs an API key of
your own; it is the one part of this that touches the network.

```bash
npx @mikeargento/exam-cli run --provider anthropic --model <id> --name mine
```

The same package points the verifier at evidence of your own, with nothing installed and nothing
cloned:

```bash
npx @mikeargento/exam-cli verify ./some-folder.exam
```

**On your own bank.** The two positions do not care where the questions come from, and `exam-bank`
is only one bank. A family here is a deterministic generator and a checker: given a seed it produces
the same instance every time, and given an answer it says right or wrong with no model in the loop.
Anything of that shape drops in, and the paper is derived from the commitment exactly as it is here.
That derivation is what produces the floor, so a generated bank is the case this was built for.

A hand-written set is the other case, and it is worth being exact about what it buys. You can commit
the set at a position, which binds those bytes to it: the set becomes tamper evident, and it is
ordered against everything recorded afterwards. It does not give the questions a floor. They were
written before they were committed, so the commitment is a postmark, and a postmark is the wrong
direction for contamination. A held-out set gets the ordering; only a derived set gets the
not-before.

---

## What is in here

```
demo/<model>.exam/                the six sittings; each holds:
  paper/                            paper.json (the twenty questions), new-file/paper.fused.json (the committed bytes), proof.json,
                                    base-floor/floor-header.json (the floor block's header), base-ceiling/ceiling.json (the Base ceiling)
  answers/                          answers.json, proof.json, base-floor/, base-ceiling/
  bank/                             bank.json, generator.tar, proof.json (the bank's own recording, position 8546), ethereum-anchors/
  raw/q01.json … q20.json           every request and reply, verbatim
  README.txt, report.html, verdict.json
demo/<model>.console.txt          what `exam run` printed
archive/2026-09-sittings/         the September 2026 sittings and fixtures, on the Ethereum floor; they verify as they did
archive/2026-09-fixtures/
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

# exam

A command-line tool that opens a BitGraph position, derives a set of exam questions from that
position's commitment, seals the paper under it, asks a model through its own API, seals the
model's answers at a later position, grades by re-running the bank's checkers, and writes a
folder anyone can verify offline.

**Proves:** the exact question instances were derived from a commitment that did not exist before
the floor block, so they were not in any training set frozen before that block; the paper's
digest spent that slot; the answer sheet names the paper and sits at a later position on the
same chain.

**Does not prove:** that the template families are unfamiliar to the model; that the model
worked alone, without tools, or quickly; when the answers were produced beyond their own floor.
The answer sheet has a floor, not a ceiling. Nothing here prints a ceiling, and nothing prints
"at" a time: floors are "not before block N (header time T)".

## Run

```
exam run --provider anthropic --model claude-sonnet-5 --name agent-run-0912
```

prints, for people:

```
Opened position 8549. Floor: block 25962561, 12 Sep 2026 16:34:35Z.
Wrote 20 questions from that position and sealed them at position 8552. Floor: block 25962561, 12 Sep 2026 16:34:35Z.
Sealed the answers at position 8562. Floor: block 25962566.
Asked claude-sonnet-5. 20 answers back.
Verified
Score 14/20. Report: agent-run-0912.exam/report.html
```

and opens `report.html`. `--json` prints the verdict object instead. The API key comes from the
environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`); it is
never written anywhere. Each step is also its own command: `open`, `paper`, `ask`, `grade`,
`export`, `verify`, `selftest`. `exam verify <folder>` runs entirely offline and answers
ACCEPT, REJECT, or NO-EVIDENCE (exit 0, 1, 2; 3 on error), writing `verdict.json` and
`report.html` beside the files.

## The folder

`<name>.exam/` holds three units in the shape the bitgraph.ing drop zone reads (drop the whole
folder there and both positions show):

```
bank/      bank.json, generator.tar, proof.json, ethereum-anchors/     the public item bank, recorded once
paper/     paper.json, new-file/paper.fused.json, proof.json, ethereum-anchors/
answers/   answers.json, proof.json, ethereum-anchors/
raw/       q01.json …                                                 every request and reply, verbatim
README.txt the claim boundary and the two floors
```

## What a verifier does

1. The paper's BitGraph as trailer/1: signature, slot record, the fused bytes hash to the
   committed digest and carry the slot's commitment, the origin recovered by stripping the
   48-byte trailer is the one the signed attribution names, the AWS Nitro attestation chains
   to the AWS root with PCR0 equal to the proof's measurement and user_data equal to the signed
   body, the floor block's header hashes to the signed floor.
2. The seed from the recomputed commitment and the bank digest; the bank digest from the shipped
   bank and generator archive; all K questions re-instantiated and compared to the committed
   paper byte for byte.
3. The answer sheet's BitGraph; its `paperDigestB64` equals the fused paper's digest; its
   position is after the paper's, same epoch, same chain (a different epoch is undetermined,
   not a failure).
4. The grade, by re-deriving the canonical answers and running each family's checker. A
   `grade.json` in the folder is never read.

Missing proof or bank: NO-EVIDENCE. Anything that recomputes and disagrees: REJECT. Everything
checks: ACCEPT. The derivation is written down with test vectors in
`@mikeargento/exam-core/SPEC.md`.

## Fixtures

`fixtures/` holds seven folders, each with a `FIXTURE.txt` naming the expected verdict.
`exam selftest` verifies each and prints the count.

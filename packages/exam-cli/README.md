# exam

A command-line tool that opens a BitGraph position, derives a set of exam questions from that
position's commitment, seals the paper under it, asks a model through its own API, seals the
model's answers at a later position, grades by re-running the bank's checkers, and writes a
folder anyone can verify offline.

**Proves:** the exact question instances were derived from the position commitment, a value that
did not exist until the enclave opened the paper's position, so the questions did not exist before
that position; the position opened after its floor block, so they were not in any training set
frozen before that block; the paper's digest spent that position; the answer sheet names the paper
and sits at a later position on the same chain; where a unit's `base-ceiling/` is in the folder, it
existed by that Base block.

**Does not prove:** that the template families are unfamiliar to the model; that the model
worked alone, without tools, or quickly; that the answers came from the model the sheet names.

Every report leads with the paper's BitGraph: "These exact questions could not have existed before
BitGraph #97 began." Each BitGraph then reads as its proof page does: its floor, "not before Base
block N (header time T)" ("Ethereum block N" for a paper made before enclave v10, 7 October 2026
01:47 UTC); its recorded
time, from the AWS Nitro attestation; and its ceiling, "existed by Base block M (header time T)".
Nothing prints "at" a time.

## Run

Node 22.13 or later (the grader uses `node --permission`).

```
exam run --provider anthropic --model claude-sonnet-5-5 --name demo/claude-sonnet-5-5
```

The Sonnet 5.5 sitting in the sealed-exam repository printed, as it went:

```
Opened position 96. Floor: Base block 52275983, 7 Oct 2026 02:48:33Z.
Wrote 20 questions from that position and sealed them at position 97. Floor: Base block 52275983, 7 Oct 2026 02:48:33Z.
Asked claude-sonnet-5-5. 20 answers back.
Sealed the answers at position 99. Floor: Base block 52275994, 7 Oct 2026 02:48:55Z.
```

and `exam verify demo/claude-sonnet-5-5.exam` on that folder prints, before the line-by-line checks:

```
ACCEPT
Score 19/20
These exact questions could not have existed before BitGraph #97 began.
BitGraph #97 began after Base block 52275983.
Paper: BitGraph #97  https://bitgraph.ing/proof/ITjVZgVqhLIDZv6LYD7aXVV4Df22rdFNhH2p_z2VMp4
  floor     not before Base block 52275983 (header time 7 Oct 2026 02:48:33Z)
  recorded  7 Oct 2026 02:48:36Z (the AWS Nitro attestation's time)
  ceiling   existed by Base block 52275987 (header time 7 Oct 2026 02:48:41Z)
Answers: BitGraph #99  https://bitgraph.ing/proof/ZRj3F9ZRDk1lpdHQzZ_L1gMRYKfJACa865FUyoROXEs
  floor     not before Base block 52275994 (header time 7 Oct 2026 02:48:55Z)
  recorded  7 Oct 2026 02:48:57Z (the AWS Nitro attestation's time)
  ceiling   existed by Base block 52275996 (header time 7 Oct 2026 02:48:59Z)
```

`run` ends the same way. A ceiling is written some seconds after its BitGraph, so a folder
exported at once may say "not in this folder" for it; `exam export <name>` again adds it. `run`
also opens `report.html`. `--json` prints the verdict object instead. The API key comes from the
environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`); it is
never written anywhere. Each step is also its own command: `open`, `paper`, `ask`, `grade`,
`export`, `verify`, `selftest`. `exam verify <folder>` runs entirely offline and answers
ACCEPT, REJECT, or NO-EVIDENCE (exit 0, 1, 2; 3 on error), writing `verdict.json` and
`report.html` beside the files.

## The folder

`<name>.exam/` holds four directories in the shape the bitgraph.ing drop zone reads (drop the
whole folder there and both BitGraphs show):

```
bank/      bank.json, generator.tar, proof.json, its floor evidence       the public item bank, recorded once
paper/     paper.json, new-file/paper.fused.json, proof.json, base-floor/, base-ceiling/
answers/   answers.json, proof.json, base-floor/, base-ceiling/
raw/       q01.json …                                                 every request and reply, verbatim
README.txt the claim boundary and the two floors
```

`base-floor/floor-header.json` is the header of the Base block the proof signs as its floor
(`commit.slotFloor`), in the `bitgraph-floor-header/1` shape `@mikeargento/bitgraph-audit` reads.
`base-ceiling/ceiling.json` is the BitGraph's Base ceiling (`bitgraph-ceiling/1`, the file its
proof page downloads), kept only when it checks against the proof. A folder made before enclave v10
has `ethereum-anchors/` in its place (the anchor proofs and
their header witnesses for `commit.slotAnchor`), and verifies as it always has. While a position
is held, `slot.json` and `floor.json` (the Base block the allocation named) sit at the top; both go
when the paper spends the position.

## What a verifier does

1. The paper's BitGraph as trailer/1: signature, slot record, the fused bytes hash to the
   committed digest and carry the slot's commitment, the origin recovered by stripping the
   48-byte trailer is the one the signed attribution names, the AWS Nitro attestation chains
   to the AWS root with PCR0 equal to the proof's measurement and user_data equal to the signed
   body, the floor block's header checks against the floor the proof signs (for Base: the hash,
   the number, the signed time and Base mainnet's schedule; the time is withheld when it is later
   than the attestation). Where `base-ceiling/ceiling.json` is present, the Base ceiling: a
   transaction from BitGraph's published writer, included in a Base block by the inclusion proof
   and header the file carries, whose Merkle root covers the proof's hash. A ceiling file that does
   not check is a contradiction; an absent one is not held against the run.
2. The seed from the recomputed commitment and the bank digest; the bank digest from the shipped
   bank and generator archive; all K questions re-instantiated and compared to the committed
   paper byte for byte.
3. The answer sheet's BitGraph; its `paperDigestB64` equals the fused paper's digest; its
   position is after the paper's, same epoch, same chain (a different epoch is undetermined,
   not a failure); its attestation, floor and ceiling as in step 1; each raw reply in `raw/`
   hashes to the digest the sheet names.
4. The grade, by re-deriving the canonical answers and running each family's checker. A
   `grade.json` in the folder is never read.

Missing proof or bank: NO-EVIDENCE. Anything that recomputes and disagrees: REJECT. Everything
checks: ACCEPT. The derivation is written down with test vectors in
`@mikeargento/exam-core/SPEC.md`.

## Fixtures

`fixtures/` holds seven folders, each with a `FIXTURE.txt` naming the expected verdict.
`exam selftest` verifies each and prints the count.

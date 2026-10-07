The sealed exam

These exact questions could not have existed before BitGraph #101 began.
BitGraph #101 began after Base block 52275995.

Paper: BitGraph #101, https://bitgraph.ing/proof/r5tYygC0u32-nmwn6Yts7Gs44dtqHmC1OjBdg8Y9yYI; not before Base block 52275995.
Answers: BitGraph #103, https://bitgraph.ing/proof/mjiB-qzReIgcHAoFJL_xmrEdUlMDPzrC82h01wlXrgE; not before Base block 52276001.

Proves: the exact question instances were derived from the position commitment, a value that did not exist until the enclave opened the paper's position, so the questions did not exist before that position; the position opened after its floor block, so they were not in any training set frozen before that block; the paper's digest spent that position; the answer sheet names the paper and sits at a later position on the same chain; where a unit's base-ceiling/ is in the folder, it existed by that Base block.

Does not prove: that the template families are unfamiliar to the model; that the model worked alone, without tools, or quickly; that the answers came from the model the sheet names.

What is here:
  bank/      bank.json (the public item bank, recorded once as a BitGraph: proof.json), generator.tar (its generator source)
  paper/     paper.json (the questions), new-file/paper.fused.json (the committed bytes: paper.json + a 48-byte trailer carrying the position commitment), proof.json, base-floor/ (the header of the Base block the proof signs as its floor), base-ceiling/ (its Base ceiling)
  answers/   answers.json (the model's answers, naming the fused paper by digest), proof.json, base-floor/ (the header of the Base block the proof signs as its floor), base-ceiling/ (its Base ceiling)
  raw/       one file per question: the request sent and the reply received, verbatim

To check it, offline: `node verifier/exam.mjs verify <this folder>` from the package this came in, or `exam verify <this folder>` from @mikeargento/exam-cli (the tarballs in packages/). Or drop the folder on bitgraph.ing.
Spec: @mikeargento/exam-core SPEC.md.

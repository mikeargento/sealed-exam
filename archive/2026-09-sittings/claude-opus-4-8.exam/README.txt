The sealed exam

These exact questions could not have existed before block 25962581.

Paper: position 8610, not before block 25962581.
Answers: position 8616, not before block 25962584.

Proves: the exact question instances were derived from a commitment that did not exist before the floor block, so they were not in any training set frozen before that block; the paper's digest spent that slot; the answer sheet names the paper and sits at a later position on the same chain.

Does not prove: that the template families are unfamiliar to the model; that the model worked alone, without tools, or quickly; when the answers were produced beyond their own floor. The answer sheet has a floor, not a ceiling.

What is here:
  bank/      bank.json (the public item bank, recorded once as a BitGraph: proof.json), generator.tar (its generator source)
  paper/     paper.json (the questions), new-file/paper.fused.json (the committed bytes: paper.json + a 48-byte trailer carrying the slot commitment), proof.json, ethereum-anchors/
  answers/   answers.json (the model's answers, naming the fused paper by digest), proof.json, ethereum-anchors/
  raw/       one file per question: the request sent and the reply received, verbatim

To check it, offline: `node verifier/exam.mjs verify <this folder>` from the package this came in, or `exam verify <this folder>` from @mikeargento/exam-cli (the tarballs in packages/). Or drop the folder on bitgraph.ing.
Spec: @mikeargento/exam-core SPEC.md.

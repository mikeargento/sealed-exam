# @mikeargento/exam-core

The boundary of the sealed exam: open a slot on bitgraph.ing, derive the commitment from the signed slot record, seed an HMAC-DRBG (SHA-256, SP 800-90A) from the commitment and the bank digest, draw twenty questions, fuse the paper under `trailer/1` and commit it under that same slot, then record the answer sheet at a later position. `SPEC.md` here is the whole derivation, with test vectors.

Used by `@mikeargento/exam-cli`. The verifier is `@mikeargento/exam-verify` (MIT).

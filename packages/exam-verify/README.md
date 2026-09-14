# @mikeargento/exam-verify

The offline verifier of a sealed-exam folder: the paper's BitGraph (signature, slot binding, fused bytes, Nitro attestation to the AWS root, the floor block's header), the paper re-derived from the commitment and the bank and compared byte for byte, the answer sheet bound to the paper and after it on the chain, and the grade re-run from the seed. Three verdicts, kept apart: ACCEPT, REJECT (naming the paper, the commitment, the answers, or the order), NO-EVIDENCE. It fetches nothing.

MIT. Verification of BitGraph proofs is and remains permissionless. Run it through `exam verify <folder>` from `@mikeargento/exam-cli`.

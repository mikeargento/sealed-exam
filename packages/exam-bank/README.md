# @mikeargento/exam-bank

The question bank of the sealed exam: five deterministic generators (multi-step arithmetic, a seating puzzle with a solver-enforced unique answer, a string-transformation pipeline, a small JavaScript specification checked on hidden inputs, an ordering task over generated facts), each drawing its instances from a DRBG seeded by a slot commitment. `bank.json` is the canonical bank document; its SHA-256 is what a paper names, and `proof/` is the bank's own BitGraph, recorded before any paper.

The derivation, with vectors, is `SPEC.md` in `@mikeargento/exam-core`. Used by `@mikeargento/exam-cli`.

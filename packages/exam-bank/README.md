# @mikeargento/exam-bank

The question bank of the sealed exam: five deterministic generators (multi-step arithmetic, a seating puzzle with a solver-enforced unique answer, a string-transformation pipeline, a small JavaScript specification checked on hidden inputs, an ordering task over generated facts), each drawing its instances from a DRBG seeded by a slot commitment. `bank.json` is the canonical bank document; its SHA-256 is what a paper names, and `proof/` is the bank's own BitGraph, recorded before any paper.

The derivation, with vectors, is `SPEC.md` in `@mikeargento/exam-core`. Used by `@mikeargento/exam-cli`.

## src/ is frozen

`src/**` — the thirteen files listed by `tar -tf <sitting>/bank/generator.tar` — is archived
verbatim into every recorded sitting and hashed into the bank digest, which the paper names and the
verifier recomputes. **Editing any byte of `src/` invalidates every sitting ever recorded**, including
the six in this repository: the verifier stops being able to re-derive their papers and reports
NO-EVIDENCE for all of them.

That is the mechanism working, not a bug. It also means the ordinary housekeeping edit is not
ordinary here. On 2026-09-14 a copyright-holder sweep rewrote the header of all thirteen files and
every sitting in the package went NO-EVIDENCE; the headers still read the holder they were sealed
with, and they have to. `LICENSE` and `package.json` are NOT in the archive and can be changed
freely.

To change anything under `src/`, the bank has to be re-recorded and every sitting re-run at new
positions. Nothing else does.

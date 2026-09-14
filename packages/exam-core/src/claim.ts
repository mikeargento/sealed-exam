// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * The claim boundary, verbatim, everywhere it is printed: the README, the
 * verifier's output, the report page, and every error string that names a
 * floor. Floors only. Never a ceiling, never "at".
 */
export const CLAIM = {
  sentence: (block: number) => `These exact questions could not have existed before block ${block}.`,
  proves:
    "Proves: the exact question instances were derived from a commitment that did not exist before the floor block, so they were not in any training set frozen before that block; the paper's digest spent that slot; the answer sheet names the paper and sits at a later position on the same chain.",
  doesNotProve:
    "Does not prove: that the template families are unfamiliar to the model; that the model worked alone, without tools, or quickly; when the answers were produced beyond their own floor. The answer sheet has a floor, not a ceiling.",
  footer: "Verified offline from the files in this folder. Nothing was fetched.",
} as const;

export const CLAIM_PARAGRAPH = `${CLAIM.proves}\n\n${CLAIM.doesNotProve}`;

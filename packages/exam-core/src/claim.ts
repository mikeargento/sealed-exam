// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * The claim boundary, verbatim, everywhere it is printed: the README, the
 * verifier's output, the report page, and every error string that names a
 * floor. Floors only. Never a ceiling, never "at".
 *
 * A floor is named with its chain: "Base block N" for a paper made from
 * 2026-10-07 (enclave v10, commit.slotFloor), "Ethereum block N" for one
 * made before (commit.slotAnchor).
 */
export type FloorChain = "base" | "ethereum";

/** "Base block 52271417", "Ethereum block 25962579". */
export const blockName = (block: number, chain: FloorChain = "ethereum"): string => `${chain === "base" ? "Base" : "Ethereum"} block ${block}`;

export const CLAIM = {
  sentence: (block: number, chain: FloorChain = "ethereum") => `These exact questions could not have existed before ${blockName(block, chain)}.`,
  proves:
    "Proves: the exact question instances were derived from the position commitment, a value that did not exist until the enclave opened the paper's position, so the questions did not exist before that position; the position opened after its floor block, so they were not in any training set frozen before that block; the paper's digest spent that position; the answer sheet names the paper and sits at a later position on the same chain.",
  doesNotProve:
    "Does not prove: that the template families are unfamiliar to the model; that the model worked alone, without tools, or quickly; when the answers were produced beyond their own floor. The answer sheet has a floor, not a ceiling.",
  footer: "Verified offline from the files in this folder. Nothing was fetched.",
} as const;

export const CLAIM_PARAGRAPH = `${CLAIM.proves}\n\n${CLAIM.doesNotProve}`;

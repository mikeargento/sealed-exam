// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * The claim boundary, verbatim, everywhere it is printed: the README, the
 * verifier's output, the report page, and every error string that names a
 * floor. The lead names the BitGraph; the floor block sits under it, and a
 * Base ceiling, when its file is carried, is the block the record existed by.
 *
 * A floor is named with its chain: "Base block N" for a paper made from
 * 2026-10-07 (enclave v10, commit.slotFloor), "Ethereum block N" for one
 * made before (commit.slotAnchor).
 */
export type FloorChain = "base" | "ethereum";

/** "Base block 52271417", "Ethereum block 25962579". */
export const blockName = (block: number, chain: FloorChain = "ethereum"): string => `${chain === "base" ? "Base" : "Ethereum"} block ${block}`;

/** "BitGraph #89", "BitGraph #4,608": the commit's counter, as the proof page names it. */
export const bitgraphName = (counter: string | number): string => `BitGraph #${Number(counter).toLocaleString("en-US")}`;

export const CLAIM = {
  /** The lead (Mike, 2026-10-07): the BitGraph, not the block. "Began": the position opened before the questions were written; the commit came after. */
  sentence: (paperCounter: string | number) => `These exact questions could not have existed before ${bitgraphName(paperCounter)} began.`,
  /** The floor under it, in time. */
  began: (paperCounter: string | number, block: number, chain: FloorChain = "ethereum") => `${bitgraphName(paperCounter)} began after ${blockName(block, chain)}.`,
  proves:
    "Proves: the exact question instances were derived from the position commitment, a value that did not exist until the enclave opened the paper's position, so the questions did not exist before that position; the position opened after its floor block, so they were not in any training set frozen before that block; the paper's digest spent that position; the answer sheet names the paper and sits at a later position on the same chain; where a unit's base-ceiling/ is in the folder, it existed by that Base block.",
  doesNotProve:
    "Does not prove: that the template families are unfamiliar to the model; that the model worked alone, without tools, or quickly; that the answers came from the model the sheet names.",
  footer: "Verified offline from the files in this folder. Nothing was fetched.",
} as const;

export const CLAIM_PARAGRAPH = `${CLAIM.proves}\n\n${CLAIM.doesNotProve}`;

// Copyright (c) Argento Computing Inc. All rights reserved. See LICENSE.

/**
 * @mikeargento/exam-core: the seed, the DRBG, the paper, and the two
 * positions. SPEC.md restates the derivation with vectors so anyone can
 * re-instantiate it in any language.
 */
export { HmacDrbg } from "./drbg.js";
export { EXAM_DOMAIN, deriveSeed, DrbgRng } from "./seed.js";
export { PAPER_VERSION, derivePaper, familiesOf, isPaper, b64, fromB64, type Paper, type PaperQuestion, type DerivedPaper } from "./paper.js";
export { blockTimeFromHeader, headerHash, hexToBytes, bytesToHex0x, formatUtc } from "./rlp.js";
export { FOLDER_SUFFIX, ANCHOR_DIR, BASE_FLOOR_DIR, FLOOR_HEADER_FILE, CEILING_DIR, CEILING_FILE, paths, writeBytes, writeJson, readBytes, readJson, remove } from "./folder.js";
export {
  CHAIN, DEFAULT_BASE_URL, BoundaryError, isSlotRecord, isBaseFloorMark, isAnchorMark,
  openPosition, allocate, fetchWitness, askSide, floorOfSlot, signedFloorOf, fuseUnderSlot, fusePaper, record, anchorFilesFor, writeAnchorFiles,
  FLOOR_HEADER_VERSION, fetchBaseFloorHeader, floorEvidenceFor, writeFloorEvidence, proofPageUrl, fetchCeiling, writeCeiling,
  type Transport, type Floor, type Side, type FusedUnderSlot, type FusedPaper, type AnchorFiles,
  type BaseFloorMark, type AnchorMark, type Opened, type ExamSignedFloor, type FloorHeaderFile, type FloorEvidence, type CeilingEvidence,
} from "./boundary.js";
export { CLAIM, CLAIM_PARAGRAPH, bitgraphName, blockName, type FloorChain } from "./claim.js";
